#!/usr/bin/env python3
"""Upload compiled dist files directly to VPS without git pull."""
import os, paramiko

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

env_vars = {}
with open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env_vars[k.strip()] = v.strip()

pw = env_vars.get('VPS_PASSWORD', '')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)
print('SSH connected')

sftp = client.open_sftp()

REMOTE = '/opt/gueclaw-agent'

# Upload the fixed compiled JS file
local = os.path.join(BASE, 'dist', 'core', 'providers', 'github-copilot-oauth-provider.js')
remote = f'{REMOTE}/dist/core/providers/github-copilot-oauth-provider.js'
sftp.put(local, remote)
print(f'Uploaded: dist/core/providers/github-copilot-oauth-provider.js')

sftp.close()

# Restart bot
stdin, stdout, stderr = client.exec_command(
    'pm2 restart gueclaw-agent && sleep 2 && pm2 show gueclaw-agent | grep status')
out = stdout.read().decode()
print(out.strip())

client.close()
print('Done!')
