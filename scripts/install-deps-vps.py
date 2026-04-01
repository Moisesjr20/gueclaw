#!/usr/bin/env python3
"""Install npm dependencies on VPS."""
import paramiko
import os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
ssh_key_path = None
vps_host = '147.93.69.211'
vps_user = 'root'

with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('VPS_SSH_KEY_PATH='):
            ssh_key_path = line.split('=', 1)[1].strip()
            break

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

# Load SSH key
for KeyClass in [paramiko.Ed25519Key, paramiko.RSAKey]:
    try:
        key = KeyClass.from_private_key_file(ssh_key_path)
        break
    except:
        continue

client.connect(vps_host, port=22, username=vps_user, pkey=key, timeout=15)

print('📦 Installing npm dependencies on VPS...')

cmd = 'cd /opt/gueclaw-agent && npm install --production=false'
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
exit_code = stdout.channel.recv_exit_status()

output = stdout.read().decode()
errors = stderr.read().decode()

if output:
    print(output[:500])

if errors:
    print(f'STDERR: {errors[:500]}')

if exit_code == 0:
    print('\n✅ Dependencies installed successfully')
else:
    print(f'\n❌ Failed with exit code {exit_code}')

client.close()
