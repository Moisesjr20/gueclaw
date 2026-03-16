#!/usr/bin/env python3
"""Deploy to VPS via SSH using paramiko."""
import paramiko, sys, os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
pw = None
with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('VPS_PASSWORD='):
            pw = line.split('=', 1)[1].strip()
            break

if not pw:
    print('ERROR: VPS_PASSWORD not found in .env')
    sys.exit(1)

print('🔌 Connecting to VPS...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)
print('✅ SSH connected')

cmd = 'cd /opt/gueclaw-agent && git pull origin main 2>&1 && npm run build 2>&1 && pm2 restart gueclaw-agent 2>&1 && echo "DEPLOY_OK"'
print('🚀 Running update on VPS...')
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
out = stdout.read().decode()
err = stderr.read().decode()

print(out[:5000] if out else '(no stdout)')
if err:
    print('STDERR:', err[:1000])

client.close()

if 'DEPLOY_OK' in out:
    print('\n✅ Deploy complete!')
else:
    print('\n⚠️  Deploy may have failed — check output above')
    sys.exit(1)
