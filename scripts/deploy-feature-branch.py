#!/usr/bin/env python3
"""Deploy feature branch to VPS for testing."""
import paramiko, sys, os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
ssh_key_path = None
vps_host = '147.93.69.211'
vps_user = 'root'

with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('VPS_SSH_KEY_PATH='):
            ssh_key_path = line.split('=', 1)[1].strip()
        elif line.startswith('VPS_HOST='):
            vps_host = line.split('=', 1)[1].strip()
        elif line.startswith('VPS_USER='):
            vps_user = line.split('=', 1)[1].strip()

if not ssh_key_path or not os.path.exists(ssh_key_path):
    print(f'ERROR: SSH key not found at {ssh_key_path}')
    sys.exit(1)

# Allow specifying branch via command line, default to main
import sys
branch = sys.argv[1] if len(sys.argv) > 1 else 'main'

print(f'🔌 Connecting to {vps_user}@{vps_host} using SSH key...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

# Try different key types
key = None
key_errors = []
for KeyClass in [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey]:
    try:
        key = KeyClass.from_private_key_file(ssh_key_path)
        break
    except Exception as e:
        key_errors.append(f"{KeyClass.__name__}: {str(e)[:50]}")
        continue

if not key:
    print(f'ERROR: Could not load SSH key. Tried:')
    for err in key_errors:
        print(f'  - {err}')
    sys.exit(1)

client.connect(vps_host, port=22, username=vps_user, pkey=key, timeout=15)
print('✅ SSH connected')

cmd = f'''cd /opt/gueclaw-agent && \
git fetch origin && \
git checkout {branch} && \
git pull origin {branch} && \
npm run build && \
pm2 restart gueclaw-agent && \
echo "DEPLOY_OK"'''

print(f'🚀 Deploying branch: {branch}')
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
out = stdout.read().decode()
err = stderr.read().decode()

print(out[:8000] if out else '(no stdout)')
if err:
    print('STDERR:', err[:1000])

# Check PM2 status
print('\n📊 Checking PM2 status...')
stdin, stdout, stderr = client.exec_command('pm2 list && pm2 logs gueclaw-agent --lines 20 --nostream', timeout=30)
status_out = stdout.read().decode()
print(status_out[:3000])

client.close()

if 'DEPLOY_OK' in out:
    print(f'\n✅ Deploy complete! Branch {branch} is now running on VPS.')
    print('🧪 Test via Telegram: Send a message to verify the agent is responding.')
else:
    print(f'\n⚠️  Deploy may have failed — check output above')
    sys.exit(1)
