#!/usr/bin/env python3
"""Queue a hash-guarded update of the two existing apps; never include private data."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
from datetime import datetime, timezone
from cpanel import CPANEL_USER, read_file, upload, queue_job

BOT = Path(__file__).resolve().parents[1]
FILES = {
    'bot': ['server/app.js', 'server/backtests.js', 'server/backtest-store.js', 'server/optimizations.js', 'docs/research/optimization-envelope-v1.json', 'web/index.html', 'web/app.js', 'web/styles.css'],
    'acs': ['server/core/api.js', 'server/core/history-backtest.js', 'server/core/history-backtest-worker.js', 'server/core/history-worker-pool.js', 'server/core/optimization.js', 'server/core/optimization-worker.js', 'server/core/optimization-api.js', 'server/core/optimization-study.js', 'server/config/optimization-envelope-v1.json'],
}
ROOTS = {'bot': 'cryptobot/app', 'acs': 'acs/app'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--acs-worktree', required=True)
    parser.add_argument('--acs-base', required=True, help='Reviewed commit matching the previous ACS code')
    parser.add_argument('--bot-base', required=True, help='Reviewed commit matching the previous bot code')
    parser.add_argument('--reviewed-remote-hashes', help='Private JSON of individually reviewed base exceptions')
    args = parser.parse_args()
    if not CPANEL_USER or not CPANEL_USER.isalnum(): raise SystemExit('Set CRYPTOBOT_CPANEL_USER locally')
    roots = {'bot': BOT, 'acs': Path(args.acs_worktree).resolve()}
    bases = {'bot': args.bot_base, 'acs': args.acs_base}
    exceptions = json.loads(Path(args.reviewed_remote_hashes).read_text()) if args.reviewed_remote_hashes else {}
    for app, base in bases.items():
        subprocess.check_call(['git', 'rev-parse', '--verify', base + '^{commit}'], cwd=roots[app], stdout=subprocess.DEVNULL)
    for root in roots.values():
        if subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).strip():
            raise SystemExit('Commit and review both worktrees before packaging')
    revisions = {key: subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip() for key, root in roots.items()}
    digest = hashlib.sha256()
    for relative in ['server', 'web', 'lsnode', 'package.json', 'pnpm-lock.yaml']:
        path = BOT / relative
        for file in sorted(path.rglob('*') if path.is_dir() else [path]):
            if file.is_file(): digest.update(str(file.relative_to(BOT)).encode() + b'\0' + file.read_bytes())
    release = 'web-' + digest.hexdigest()[:16]
    home = '/home/' + CPANEL_USER
    manifest = {'release': release, 'revisions': revisions, 'files': [], 'expectedMarkers': {}, 'readOnlyDependencies': []}
    for relative in ['server/config/paper.js', 'server/core/strategy-rules.js', 'server/core/strategy-features.js', 'server/core/token-analysis.js', 'public/strategy-params.js']:
        target = Path(relative)
        remote = read_file(home + '/acs/app/' + str(target.parent), target.name).encode()
        reviewed = subprocess.check_output(['git', 'show', bases['acs'] + ':' + relative], cwd=roots['acs'])
        if remote != reviewed:
            raise SystemExit('ACS runtime dependency differs from reviewed base: ' + relative)
        manifest['readOnlyDependencies'].append({'path': relative, 'sha256': hashlib.sha256(remote).hexdigest()})
    payloads = {}
    for app, files in FILES.items():
        marker = 'RELEASE' if app == 'bot' else 'DEPLOYED.txt'
        manifest['expectedMarkers'][app] = read_file(home + '/' + ROOTS[app], marker)
        for relative in files + [marker]:
            if relative == marker:
                data = ((release if app == 'bot' else revisions['acs'] + ' ' + datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')) + '\n').encode()
            else: data = (roots[app] / relative).read_bytes()
            target = Path(relative)
            try: before = read_file(home + '/' + ROOTS[app] + '/' + str(target.parent), target.name).encode()
            except RuntimeError:
                # The job independently verifies absence; an unexpected existing file aborts.
                before = None
            if relative != marker:
                previous = subprocess.run(['git', 'show', bases[app] + ':' + relative], cwd=roots[app], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                expected = hashlib.sha256(previous.stdout).hexdigest() if previous.returncode == 0 else None
                expected = exceptions.get(app + '/' + relative, expected)
                actual = hashlib.sha256(before).hexdigest() if before is not None else None
                if actual != expected:
                    raise SystemExit('Remote differs from reviewed base: ' + app + '/' + relative + '; inspect before retry')
            manifest['files'].append({'app': app, 'path': relative, 'before': hashlib.sha256(before).hexdigest() if before is not None else None,
                                      'after': hashlib.sha256(data).hexdigest()})
            payloads[app + '/' + relative] = data
    package = io.BytesIO()
    with tarfile.open(fileobj=package, mode='w:gz') as archive:
        payloads['manifest.json'] = json.dumps(manifest).encode()
        for name, data in payloads.items():
            info = tarfile.TarInfo(name); info.size = len(data); info.mode = 0o600
            archive.addfile(info, io.BytesIO(data))
    body = package.getvalue(); sha = hashlib.sha256(body).hexdigest()
    job = 'cryptobot-optimization-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    upload(home + '/acs-ops', job + '.tar.gz', body)
    script = r'''set -eu
umask 077
BASE="$HOME/cryptobot/integration/__JOB__"
BACKUP="$BASE/backup"
PACKAGE="$HOME/acs-ops/__JOB__.tar.gz"
test "$(sha256sum "$PACKAGE" | cut -d' ' -f1)" = '__SHA__'
mkdir -p "$BASE/stage" "$BACKUP"
tar xzf "$PACKAGE" -C "$BASE/stage"
cat > "$BASE/apply.py" <<'PY'
import hashlib,json,os,shutil,sys
from pathlib import Path
base=Path(sys.argv[1]); action=sys.argv[2]; manifest=json.loads((base/'stage/manifest.json').read_text())
roots={'bot':Path.home()/'cryptobot/app','acs':Path.home()/'acs/app'}
def target(row):
 p=roots[row['app']]/row['path']
 if os.path.commonpath([str(p.resolve()),str(roots[row['app']].resolve())])!=str(roots[row['app']].resolve()): raise SystemExit('Unsafe target')
 return p
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
if action=='check':
 for row in manifest['readOnlyDependencies']:
  if digest(roots['acs']/row['path'])!=row['sha256']: raise SystemExit('ACS runtime dependency changed')
 for app,value in manifest['expectedMarkers'].items():
  marker='RELEASE' if app=='bot' else 'DEPLOYED.txt'
  if (roots[app]/marker).read_text()!=value: raise SystemExit('Deployment marker changed; review before retry')
 for row in manifest['files']:
  if digest(target(row))!=row['before']: raise SystemExit('Remote file changed; review before retry')
  if digest(base/'stage'/row['app']/row['path'])!=row['after']: raise SystemExit('Package hash mismatch')
elif action=='apply':
 for row in manifest['files']:
  p=target(row); backup=base/'backup'/row['app']/row['path'];backup.parent.mkdir(parents=True,exist_ok=True)
  if p.exists(): shutil.copy2(p,backup)
 for row in manifest['files']:
  p=target(row);p.parent.mkdir(parents=True,exist_ok=True);temp=p.with_name(p.name+'.integration-tmp')
  shutil.copyfile(base/'stage'/row['app']/row['path'],temp);os.chmod(temp,0o644);os.replace(temp,p)
elif action=='rollback':
 for row in manifest['files']:
  p=target(row);backup=base/'backup'/row['app']/row['path']
  if backup.exists(): shutil.copy2(backup,p)
  elif row['before'] is None and p.exists(): p.unlink()
PY
python3 "$BASE/apply.py" "$BASE" check
/opt/alt/alt-nodejs24/root/usr/bin/node --input-type=module - "$HOME/cryptobot/state/app.sqlite" "$BACKUP/account-before.sqlite" <<'JS'
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, chmodSync } from 'node:fs';
if (existsSync(process.argv[2])) {
 const source = new DatabaseSync(process.argv[2], { readOnly: true });
 try { await backup(source, process.argv[3]); chmodSync(process.argv[3], 0o600); }
 finally { source.close(); }
}
JS
rollback() {
  python3 "$BASE/apply.py" "$BASE" rollback
  /usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=acs/app >/dev/null
  /usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=cryptobot/app >/dev/null
  echo 'Integration failed; previous app files restored'
}
trap rollback ERR
python3 "$BASE/apply.py" "$BASE" apply
/usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=acs/app
/usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=cryptobot/app
python3 - "$BASE" <<'PYREADY'
import json,sys,time,urllib.request
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'stage/manifest.json').read_text())
deadline=time.monotonic()+90
while True:
 try:
  def get(url,name):
   request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
   with urllib.request.urlopen(request,timeout=min(10,max(1,deadline-time.monotonic()))) as response:
    raw=response.read(4*1024*1024)
   (p/'backup'/name).write_bytes(raw)
   return json.loads(raw)
  a=get('https://aistat.app/crypto/api/analysis/v1?chainId=4663','analysis-smoke.json')
  b=get('https://aistat.app/bot/api/health','bot-health.json')
  ready=(a.get('schemaVersion')=='acs.analysis.v1' and a.get('chainId')==4663 and a.get('executionAuthorized') is False
   and a.get('source',{}).get('revision')==m['revisions']['acs']
   and b.get('release')==m['release'] and b.get('liveEnabled') is False and b.get('paperEnabled') is False)
  if ready:
   print('Verified shared schema/source revision and bot release; execution disabled')
   break
 except Exception:
  pass
 if time.monotonic()>=deadline: raise SystemExit('Readiness deadline exceeded; exact source/release not observed')
 time.sleep(min(3,max(0,deadline-time.monotonic())))
PYREADY
trap - ERR
echo 'Integration activated __RELEASE__'
'''.replace('__JOB__', job).replace('__SHA__', sha).replace('__RELEASE__', release)
    queue_job(job, script)
    result = {'job': job, 'release': release, 'revisions': revisions, 'bundleSha256': sha, 'bytes': len(body)}
    output = BOT / 'artifacts/optimization-deployment.json'; output.write_text(json.dumps(result, indent=2)+'\n'); output.chmod(0o600)
    print(json.dumps(result))

if __name__ == '__main__': main()
