#!/usr/bin/env python3
"""Quick deploy - just copy dist and restart PM2"""
import paramiko, sys

VPS_PASSWORD = "2ZeVU0IfAwjKW93'g1B+"

print('🔌 Connecting to VPS...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=VPS_PASSWORD, timeout=15)
print('✅ SSH connected')

# Upload dist folder using SFTP
print('📤 Uploading dist folder...')
sftp = client.open_sftp()

import os
local_dist = 'dist'
remote_dist = '/opt/gueclaw-agent/dist'

def upload_dir(local, remote):
    """Recursively upload directory"""
    try:
        sftp.stat(remote)
    except:
        sftp.mkdir(remote)
    
    for item in os.listdir(local):
        local_path = os.path.join(local, item)
        remote_path = f"{remote}/{item}"
        
        if os.path.isfile(local_path):
            print(f"  → {remote_path}")
            sftp.put(local_path, remote_path)
        elif os.path.isdir(local_path):
            upload_dir(local_path, remote_path)

upload_dir(local_dist, remote_dist)
sftp.close()

print('🔄 Restarting PM2...')
stdin, stdout, stderr = client.exec_command('cd /opt/gueclaw-agent && pm2 restart gueclaw-agent 2>&1', timeout=30)
out = stdout.read().decode()
print(out)

client.close()
print('✅ Deploy complete!')
