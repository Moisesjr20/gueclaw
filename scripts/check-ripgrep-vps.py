#!/usr/bin/env python3
"""Check and install ripgrep on VPS."""
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

# Check ripgrep
print('🔍 Checking if ripgrep is installed...')
stdin, stdout, stderr = client.exec_command('rg --version', timeout=10)
exit_code = stdout.channel.recv_exit_status()

if exit_code == 0:
    version = stdout.read().decode().strip()
    print(f'✅ ripgrep is already installed:\n{version}')
else:
    print('⚠️  ripgrep not found. Installing...')
    stdin, stdout, stderr = client.exec_command('apt update && apt install -y ripgrep', timeout=120)
    install_output = stdout.read().decode()
    install_err = stderr.read().decode()
    
    if install_err:
        print(f'STDERR: {install_err[:500]}')
    
    # Verify installation
    stdin, stdout, stderr = client.exec_command('rg --version', timeout=10)
    if stdout.channel.recv_exit_status() == 0:
        version = stdout.read().decode().strip()
        print(f'✅ ripgrep installed successfully:\n{version}')
    else:
        print('❌ Failed to install ripgrep')

client.close()
