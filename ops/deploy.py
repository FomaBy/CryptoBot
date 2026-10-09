#!/usr/bin/env python3
"""Package an explicit web release and queue its first installation on cPanel.

Requires CRYPTOBOT_CPANEL_USER and a local token file. No secrets enter the bundle.
The remote runner's completed output and HTTP checks must be inspected separately.
"""
import hashlib
import io
import json
from pathlib import Path
import tarfile
from datetime import datetime, timezone
from cpanel import CPANEL_USER, read_file, upload, queue_job

ROOT = Path(__file__).resolve().parents[1]

def main():
    if not CPANEL_USER or not CPANEL_USER.isalnum():
        raise SystemExit('Set CRYPTOBOT_CPANEL_USER locally')
    paths = [ROOT / p for p in ['server', 'web', 'lsnode', 'package.json', 'pnpm-lock.yaml', 'node_modules']]
    if not (ROOT / 'node_modules/ethers').exists():
        raise SystemExit('Install the locked dependencies first')
    digest = hashlib.sha256()
    for directory in paths[:-1]:
        for path in sorted(directory.rglob('*') if directory.is_dir() else [directory]):
            if path.is_file(): digest.update(str(path.relative_to(ROOT)).encode() + b'\0' + path.read_bytes())
    release = 'web-' + digest.hexdigest()[:16]
    content = io.BytesIO()
    with tarfile.open(fileobj=content, mode='w:gz') as archive:
        for path in paths: archive.add(path, arcname=path.name)
        info = tarfile.TarInfo('RELEASE'); payload = (release + '\n').encode(); info.size = len(payload); info.mode = 0o644
        archive.addfile(info, io.BytesIO(payload))
    bundle = content.getvalue(); bundle_hash = hashlib.sha256(bundle).hexdigest()
    home = '/home/' + CPANEL_USER
    original = read_file(home + '/public_html', '.htaccess')
    original_hash = hashlib.sha256(original.encode()).hexdigest()
    if '# CryptoBot exact route' in original:
        raise SystemExit('Already installed: use a reviewed update release, not bootstrap')
    job = 'cryptobot-install-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    upload(home + '/acs-ops', release + '.tar.gz', bundle)
    script = r'''set -eu
umask 077
BASE="$HOME/cryptobot"
APP="$BASE/app"
BACKUP="$BASE/backups/__JOB__"
SOURCE="$HOME/acs-ops/__RELEASE__.tar.gz"
test ! -e "$APP" || { echo "Refusing bootstrap over an existing app"; exit 1; }
test "$(sha256sum "$SOURCE" | cut -d' ' -f1)" = '__BUNDLE_HASH__'
test "$(sha256sum "$HOME/public_html/.htaccess" | cut -d' ' -f1)" = '__ORIGINAL_HASH__' || { echo "Root routing changed: review required"; exit 1; }
mkdir -p "$BACKUP" "$BASE/state" "$BASE/stage" "$APP"
cp -p "$HOME/public_html/.htaccess" "$BACKUP/root.htaccess"
rollback() {
  cp "$BACKUP/root.htaccess" "$HOME/public_html/.htaccess"
  echo "Activation failed; original root routing restored"
}
trap rollback ERR
tar xzf "$SOURCE" -C "$BASE/stage"
for item in server web lsnode package.json pnpm-lock.yaml RELEASE; do cp -a "$BASE/stage/$item" "$APP/"; done
chmod 711 "$BASE"; chmod 755 "$APP"
find "$APP/server" "$APP/web" "$APP/lsnode" -type d -exec chmod 755 {} +
find "$APP/server" "$APP/web" "$APP/lsnode" -type f -exec chmod 644 {} +
chmod 644 "$APP/package.json" "$APP/RELEASE"
/usr/sbin/cloudlinux-selector create --json --interpreter=nodejs --domain=aistat.app --app-root=cryptobot/app --app-uri=/bot --version=24 --app-mode=production --startup-file=lsnode/app.cjs --env-vars="{\"CRYPTOBOT_DB\":\"$BASE/state/app.sqlite\",\"CRYPTOBOT_ORIGIN\":\"https://aistat.app\"}" > "$BACKUP/selector-create.json"
python3 - "$BACKUP/selector-create.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
if r.get('result') != 'success': raise SystemExit('Selector creation did not confirm success')
PY
chmod 755 "$HOME/public_html/bot"
chmod 644 "$HOME/public_html/bot/.htaccess"
mkdir -p "$APP/node_modules"
cp -a "$BASE/stage/node_modules/." "$APP/node_modules/"
mkdir -p "$APP/tmp"; chmod 755 "$APP/tmp"
cd "$APP"
/opt/alt/alt-nodejs24/root/usr/bin/node --input-type=module -e 'import {verifyMessage} from "ethers"; import {DatabaseSync} from "node:sqlite"; const d=new DatabaseSync(":memory:");d.close();console.log("Runtime dependencies verified")'
python3 - "$HOME/public_html/.htaccess" <<'PY'
import os,sys
from pathlib import Path
p=Path(sys.argv[1]); s=p.read_text()
anchor='RewriteEngine On'
if anchor not in s: raise SystemExit('Rewrite anchor missing')
addition='\n# CryptoBot exact route\nRewriteCond %{HTTPS} !=on\nRewriteRule ^bot(/.*)?$ https://aistat.app/bot$1 [R=301,L]\nRewriteRule ^bot(/.*)?$ - [L]\n'
p.with_suffix('.cryptobot.tmp').write_text(s.replace(anchor,anchor+addition,1))
os.chmod(p.with_suffix('.cryptobot.tmp'),0o644)
os.replace(p.with_suffix('.cryptobot.tmp'),p)
PY
/usr/sbin/cloudlinux-selector restart --json --interpreter=nodejs --app-root=cryptobot/app > "$BACKUP/selector-restart.json"
touch tmp/restart.txt; chmod 644 tmp/restart.txt
sleep 2
curl --fail --silent --show-error --max-time 35 https://aistat.app/bot/api/health > "$BACKUP/health.json"
python3 - "$BACKUP/health.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
assert r.get('status')=='ok' and r.get('release')=='__RELEASE__' and r.get('liveEnabled') is False
PY
trap - ERR
echo "Activated __RELEASE__; health verified; live disabled"
'''
    for key, value in [('__JOB__',job), ('__RELEASE__',release), ('__BUNDLE_HASH__',bundle_hash), ('__ORIGINAL_HASH__',original_hash)]: script = script.replace(key,value)
    queue_job(job, script)
    manifest = {'job':job,'release':release,'bundleSha256':bundle_hash,'rootBeforeSha256':original_hash,'bytes':len(bundle),'status':'queued'}
    target = ROOT / 'artifacts/deployment.json'; target.parent.mkdir(exist_ok=True); target.write_text(json.dumps(manifest,indent=2)+'\n'); target.chmod(0o600)
    print(json.dumps(manifest))

if __name__ == '__main__': main()
