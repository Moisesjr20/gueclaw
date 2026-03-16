#!/usr/bin/env python3
"""Upload changed files to VPS and rebuild."""
import paramiko, sys, os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
pw = None
with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('VPS_PASSWORD='):
            pw = line.split('=', 1)[1].strip()
            break

if not pw:
    print('ERROR: VPS_PASSWORD not found')
    sys.exit(1)

print('🔌 Connecting to VPS...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)
print('✅ SSH connected')

# Files to upload
base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
uploads = [
    ('src/core/providers/github-copilot-oauth-provider.ts',
     '/opt/gueclaw-agent/src/core/providers/github-copilot-oauth-provider.ts'),
    ('src/core/agent-loop/agent-loop.ts',
     '/opt/gueclaw-agent/src/core/agent-loop/agent-loop.ts'),
]

sftp = client.open_sftp()
for local_rel, remote_path in uploads:
    local_path = os.path.join(base, local_rel.replace('/', os.sep))
    print(f'📤 Uploading {local_rel}...')
    sftp.put(local_path, remote_path)
    print(f'   ✅ Done')
sftp.close()

# Build and restart
print('🔨 Building and restarting...')
cmd = 'cd /opt/gueclaw-agent && npm run build 2>&1 && pm2 restart gueclaw-agent 2>&1 && echo "REBUILD_OK"'
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode()
err = stderr.read().decode()

print(out[:3000] if out else '(no stdout)')
if err:
    print('STDERR:', err[:500])

client.close()

if 'REBUILD_OK' in out:
    print('\n✅ Rebuild + restart complete!')
else:
    print('\n⚠️ Check output above')
    sys.exit(1)
