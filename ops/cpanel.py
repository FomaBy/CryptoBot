#!/usr/bin/env python3
"""Narrow cPanel transport; credentials are read locally and never printed."""
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import uuid

CPANEL_URL = 'https://aistat.app:2083'
CPANEL_USER = os.environ.get('CRYPTOBOT_CPANEL_USER', '')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('cPanel redirects are forbidden')

def _request(path, data=None, content_type=None):
    if not CPANEL_USER or not CPANEL_USER.isalnum():
        raise RuntimeError('Set CRYPTOBOT_CPANEL_USER locally')
    token_path = Path(os.environ.get('CRYPTOBOT_CPANEL_TOKEN_FILE', str(Path.home() / '.config/aistat/cpanel.token')))
    headers = {'Authorization': f'cpanel {CPANEL_USER}:' + token_path.read_text().strip()}
    if content_type:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(CPANEL_URL + path, data=data, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=90) as response:
            result = json.load(response)
    except Exception as exc:
        raise RuntimeError('cPanel transport failed (details suppressed)') from None
    if not result.get('status'):
        raise RuntimeError('cPanel operation rejected (details suppressed)')
    return result.get('data')

def read_file(directory, filename):
    return _request('/execute/Fileman/get_file_content?' + urllib.parse.urlencode({'dir': directory, 'file': filename}))['content']

def upload(directory, filename, content):
    boundary = 'CryptoBot' + uuid.uuid4().hex
    parts = []
    for key, value in [('dir', directory), ('overwrite', '1')]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file-1"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    data = _request('/execute/Fileman/upload_files', b''.join(parts), 'multipart/form-data; boundary=' + boundary)
    if not data.get('succeeded'):
        raise RuntimeError('cPanel upload did not succeed')

def queue_job(name, script):
    if not all(c.isalnum() or c in '-_' for c in name):
        raise ValueError('Invalid job name')
    upload(f'/home/{CPANEL_USER}/acs-ops/jobs', name + '.sh', script.encode())
