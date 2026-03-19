#!/usr/bin/env python3
"""Deploy whatsapp-leads-sender skill to VPS."""
import os
import paramiko

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Read credentials from .env
env_vars = {}
with open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env_vars[k.strip()] = v.strip()

pw = env_vars.get('VPS_PASSWORD', '')
if not pw:
    print('ERROR: VPS_PASSWORD not found in .env')
    raise SystemExit(1)

print('Connecting to VPS (147.93.69.211)...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)
print('SSH connected')

sftp = client.open_sftp()

def ensure_remote_dir(path):
    try:
        sftp.stat(path)
    except FileNotFoundError:
        parent = os.path.dirname(path)
        if parent and parent != path:
            ensure_remote_dir(parent)
        sftp.mkdir(path)
        print(f'  Created dir: {path}')

def upload(local_rel, remote_path):
    local_path = os.path.join(BASE, local_rel.replace('/', os.sep))
    ensure_remote_dir(os.path.dirname(remote_path))
    sftp.put(local_path, remote_path)
    print(f'  Uploaded: {local_rel}')

REMOTE_BASE = '/opt/gueclaw-agent'
SKILL = '.agents/skills/whatsapp-leads-sender'

uploads = [
    (f'{SKILL}/SKILL.md',                   f'{REMOTE_BASE}/{SKILL}/SKILL.md'),
    (f'{SKILL}/scripts/uazapi_helper.py',   f'{REMOTE_BASE}/{SKILL}/scripts/uazapi_helper.py'),
    (f'{SKILL}/scripts/check_whatsapp.py',  f'{REMOTE_BASE}/{SKILL}/scripts/check_whatsapp.py'),
    (f'{SKILL}/scripts/send_campaign.py',   f'{REMOTE_BASE}/{SKILL}/scripts/send_campaign.py'),
    (f'{SKILL}/scripts/worker.py',          f'{REMOTE_BASE}/{SKILL}/scripts/worker.py'),
    (f'{SKILL}/scripts/report.py',          f'{REMOTE_BASE}/{SKILL}/scripts/report.py'),
]

print(f'\nUploading {len(uploads)} files...')
for local_rel, remote_path in uploads:
    upload(local_rel, remote_path)

# Create data dir on VPS
stdin, stdout, stderr = client.exec_command(
    f'mkdir -p {REMOTE_BASE}/{SKILL}/data && echo OK')
print(f'\nCreated data dir: {stdout.read().decode().strip()}')

# Upload leads CSV only if NOT already present on VPS (never overwrite live data)
csv_remote = f'{REMOTE_BASE}/{SKILL}/data/leads.csv'
stdin, stdout, stderr = client.exec_command(f'test -f {csv_remote} && echo EXISTS || echo MISSING')
csv_exists = stdout.read().decode().strip()
if csv_exists == 'MISSING':
    csv_local = os.path.join(BASE, 'tmp', 'relatrorio de leads de advocacia.csv')
    if os.path.exists(csv_local):
        ensure_remote_dir(os.path.dirname(csv_remote))
        sftp.put(csv_local, csv_remote)
        print(f'  Uploaded: leads.csv (first upload)')
    else:
        print('  WARNING: leads.csv not found locally and not on VPS')
else:
    print(f'  Skipped: leads.csv already exists on VPS (preserving live data)')

sftp.close()

# Restart bot to pick up new skill
print('\nRestarting gueclaw-agent...')
stdin, stdout, stderr = client.exec_command(
    'cd /opt/gueclaw-agent && pm2 restart gueclaw-agent && sleep 3 && pm2 show gueclaw-agent | grep status')
out = stdout.read().decode()
print(out.strip() if out.strip() else stderr.read().decode())

client.close()
print('\nDeploy done!')
