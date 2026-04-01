#!/usr/bin/env python3
"""Check VPS logs for Phase 1B functionality."""
import paramiko, sys, os

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

# Check logs and git status
cmd = '''cd /opt/gueclaw-agent && \
echo "=== GIT STATUS ===" && \
git log --oneline -5 && \
git branch --show-current && \
echo "" && \
echo "=== RECENT LOGS (Last 50 lines) ===" && \
pm2 logs gueclaw-agent --lines 50 --nostream | tail -50 && \
echo "" && \
echo "=== TOOL REGISTRY CHECK ===" && \
grep -r "SkillTool\|ForkedExecutor" dist/tools/ dist/core/skills/ 2>/dev/null | head -20 || echo "Build artifacts present"
'''

stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
out = stdout.read().decode()

print(out[:10000])

client.close()
