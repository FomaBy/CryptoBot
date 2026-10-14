#!/usr/bin/env python3
"""Deploy only reviewed web assets and release marker; never modify account data or ACS."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
from datetime import datetime, timezone
from cpanel import CPANEL_USER, read_file, upload, queue_job

ROOT = Path(__file__).resolve().parents[1]
WEB = ['web/index.html', 'web/app.js', 'web/styles.css']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    parser.add_argument('--expected-release', required=True)
    args = parser.parse_args()
    if not CPANEL_USER or not CPANEL_USER.isalnum():
        raise SystemExit('Set CRYPTOBOT_CPANEL_USER locally')
    if subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT).strip():
        raise SystemExit('Commit and review before packaging')
    backend_changes = subprocess.check_output([
        'git', 'diff', '--name-only', args.base, 'HEAD', '--',
        'server', 'lsnode', 'package.json', 'pnpm-lock.yaml'
    ], cwd=ROOT).strip()
    if backend_changes:
        raise SystemExit('Backend differs from reviewed base; this deploy supports web-only changes')
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
    digest = hashlib.sha256()
    for relative in ['server', 'web', 'lsnode', 'package.json', 'pnpm-lock.yaml']:
        path = ROOT / relative
        for file in sorted(path.rglob('*') if path.is_dir() else [path]):
            if file.is_file():
                digest.update(str(file.relative_to(ROOT)).encode() + b'\0' + file.read_bytes())
    release = 'web-' + digest.hexdigest()[:16]
    remote_root = '/home/' + CPANEL_USER + '/cryptobot/app'
    previous_marker = read_file(remote_root, 'RELEASE')
    if previous_marker.strip() != args.expected_release:
        raise SystemExit('Release changed; inspect before retry')
    payloads = {}
    manifest = {'revision': revision, 'release': release, 'previousRelease': args.expected_release, 'files': []}
    for relative in WEB + ['RELEASE']:
        file = Path(relative)
        before = previous_marker.encode() if relative == 'RELEASE' else read_file(remote_root + '/' + str(file.parent), file.name).encode()
        if relative != 'RELEASE':
            reviewed = subprocess.check_output(['git', 'show', args.base + ':' + relative], cwd=ROOT)
            if before != reviewed:
                raise SystemExit('Remote web asset differs from reviewed base: ' + relative)
        after = (release + '\n').encode() if relative == 'RELEASE' else (ROOT / relative).read_bytes()
        manifest['files'].append({'path': relative, 'before': hashlib.sha256(before).hexdigest(), 'after': hashlib.sha256(after).hexdigest()})
        payloads[relative] = after
    payloads['manifest.json'] = json.dumps(manifest).encode()
    bundle = io.BytesIO()
    with tarfile.open(fileobj=bundle, mode='w:gz') as archive:
        for name, data in payloads.items():
            entry = tarfile.TarInfo(name); entry.size = len(data); entry.mode = 0o600
            archive.addfile(entry, io.BytesIO(data))
    job = 'cryptobot-web-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    body = bundle.getvalue(); bundle_hash = hashlib.sha256(body).hexdigest()
    upload('/home/' + CPANEL_USER + '/acs-ops', job + '.tar.gz', body)
    script = r'''set -eu
umask 077
BASE="$HOME/cryptobot/ui-releases/__JOB__"
PACKAGE="$HOME/acs-ops/__JOB__.tar.gz"
test "$(sha256sum "$PACKAGE" | cut -d' ' -f1)" = '__HASH__'
mkdir -p "$BASE/stage" "$BASE/backup"
tar xzf "$PACKAGE" -C "$BASE/stage"
cat > "$BASE/files.py" <<'PYFILES'
from pathlib import Path
import hashlib,json,shutil,sys
base=Path(sys.argv[1]); action=sys.argv[2]; root=Path.home()/'cryptobot/app'
m=json.loads((base/'stage/manifest.json').read_text())
assert {f['path'] for f in m['files']}=={'web/index.html','web/app.js','web/styles.css','RELEASE'}
if action=='preflight':
 for f in m['files']:
  assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['before'], 'Remote drift before write'
  assert hashlib.sha256((base/'stage'/f['path']).read_bytes()).hexdigest()==f['after'], 'Invalid payload'
 for f in m['files']:
  saved=base/'backup'/f['path']; saved.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(root/f['path'],saved)
elif action=='apply':
 for f in m['files']:
  target=root/f['path']; temporary=target.with_name(target.name+'.ui-tmp')
  shutil.copyfile(base/'stage'/f['path'],temporary);temporary.chmod(0o644);temporary.replace(target)
elif action=='rollback':
 for f in m['files']: shutil.copy2(base/'backup'/f['path'],root/f['path'])
else: raise SystemExit('Invalid operation')
PYFILES
python3 "$BASE/files.py" "$BASE" preflight
rollback() {
 python3 "$BASE/files.py" "$BASE" rollback
 /usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=cryptobot/app >/dev/null
 echo 'Web assets restored; account data and ACS untouched'
}
trap rollback ERR
python3 "$BASE/files.py" "$BASE" apply
/usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=cryptobot/app
python3 - "$BASE" <<'PYREADY'
from pathlib import Path
import hashlib,json,sys,time,urllib.request,urllib.error
base=Path(sys.argv[1]);m=json.loads((base/'stage/manifest.json').read_text());deadline=time.monotonic()+90
def get(path):
 request=urllib.request.Request('https://aistat.app'+path,headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=min(10,max(1,deadline-time.monotonic()))) as response:return response.read(4*1024*1024)
while True:
 try:
  health=json.loads(get('/bot/api/health'))
  assert health['release']==m['release'] and health['liveEnabled'] is False and health['paperEnabled'] is False
  for row in m['files']:
   if row['path']=='RELEASE':continue
   url='/bot/' if row['path']=='web/index.html' else '/bot/'+Path(row['path']).name
   assert hashlib.sha256(get(url)).hexdigest()==row['after']
  assert json.loads(get('/bot/api/session'))['authenticated'] is False
  try:get('/bot/api/tasks');raise AssertionError('Unauthenticated data access')
  except urllib.error.HTTPError as e:assert e.code==401
  get('/login');get('/crypto/')
  (base/'backup/verified.json').write_text(json.dumps({'release':health['release'],'assetHashes':'match','unauthenticatedTasks':401,'rootLogin':200,'crypto':200}))
  print('Verified exact UI assets/release, login and ACS; live/paper disabled')
  break
 except Exception:
  if time.monotonic()>=deadline:raise
  time.sleep(min(3,max(0,deadline-time.monotonic())))
PYREADY
trap - ERR
echo 'Web release activated __RELEASE__'
'''.replace('__JOB__', job).replace('__HASH__', bundle_hash).replace('__RELEASE__', release)
    queue_job(job, script)
    result = {**manifest, 'job': job, 'bundleSha256': bundle_hash}
    destination = ROOT / 'artifacts/ui-refresh-deployment.json'
    destination.write_text(json.dumps(result, indent=2) + '\n'); destination.chmod(0o600)
    print(json.dumps({'job': job, 'release': release, 'revision': revision, 'bundleSha256': bundle_hash}))


if __name__ == '__main__':
    main()
