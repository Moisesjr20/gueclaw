#!/usr/bin/env python3
"""
Deploy Google Calendar skills and updated .env to VPS.
Run locally: python3 scripts/deploy-calendar-skills.py
"""
import os
import paramiko

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# ── Read credentials from .env ────────────────────────────────────────────────
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

print('🔌 Connecting to VPS (147.93.69.211)...')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('147.93.69.211', port=22, username='root', password=pw, timeout=15)
print('✅ SSH connected')

sftp = client.open_sftp()

def ensure_remote_dir(path):
    try:
        sftp.stat(path)
    except FileNotFoundError:
        # Create parent first
        parent = os.path.dirname(path)
        if parent and parent != path:
            ensure_remote_dir(parent)
        sftp.mkdir(path)
        print(f'   📁 Created dir: {path}')

def upload(local_rel, remote_path):
    local_path = os.path.join(BASE, local_rel.replace('/', os.sep))
    ensure_remote_dir(os.path.dirname(remote_path))
    sftp.put(local_path, remote_path)
    print(f'   ✅ {local_rel}')

# ── Files to upload ────────────────────────────────────────────────────────────
REMOTE_BASE = '/opt/gueclaw-agent'

uploads = [
    # Skill: google-calendar-daily
    ('.agents/skills/google-calendar-daily/SKILL.md',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-daily/SKILL.md'),
    ('.agents/skills/google-calendar-daily/scripts/fetch_daily.py',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-daily/scripts/fetch_daily.py'),
    ('.agents/skills/google-calendar-daily/scripts/setup_cron.sh',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-daily/scripts/setup_cron.sh'),
    # Skill: google-calendar-events
    ('.agents/skills/google-calendar-events/SKILL.md',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-events/SKILL.md'),
    ('.agents/skills/google-calendar-events/scripts/create_event.py',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-events/scripts/create_event.py'),
    ('.agents/skills/google-calendar-events/scripts/get_events.py',
     f'{REMOTE_BASE}/.agents/skills/google-calendar-events/scripts/get_events.py'),
]

print('\n📤 Uploading skill files...')
for local_rel, remote_path in uploads:
    upload(local_rel, remote_path)

# ── Update .env on VPS ────────────────────────────────────────────────────────
print('\n📝 Updating .env on VPS...')

# Read current VPS .env
stdin, stdout, stderr = client.exec_command(f'cat {REMOTE_BASE}/.env')
vps_env = stdout.read().decode()

# Build the new Google Calendar block
google_block = f"""
# ===== Google Calendar Configuration =====

# Pessoal (juniormoises335@gmail.com)
GOOGLE_PERSONAL_CLIENT_ID={env_vars.get('GOOGLE_PERSONAL_CLIENT_ID', '')}
GOOGLE_PERSONAL_CLIENT_SECRET={env_vars.get('GOOGLE_PERSONAL_CLIENT_SECRET', '')}
GOOGLE_PERSONAL_REDIRECT_URI={env_vars.get('GOOGLE_PERSONAL_REDIRECT_URI', '')}
GOOGLE_PERSONAL_REFRESH_TOKEN={env_vars.get('GOOGLE_PERSONAL_REFRESH_TOKEN', '')}
GOOGLE_PERSONAL_CALENDAR_ID={env_vars.get('GOOGLE_PERSONAL_CALENDAR_ID', '')}

# Profissional (contato@kyrius.info)
GOOGLE_WORK_CLIENT_ID={env_vars.get('GOOGLE_WORK_CLIENT_ID', '')}
GOOGLE_WORK_CLIENT_SECRET={env_vars.get('GOOGLE_WORK_CLIENT_SECRET', '')}
GOOGLE_WORK_REDIRECT_URI={env_vars.get('GOOGLE_WORK_REDIRECT_URI', '')}
GOOGLE_WORK_REFRESH_TOKEN={env_vars.get('GOOGLE_WORK_REFRESH_TOKEN', '')}
GOOGLE_WORK_CALENDAR_ID={env_vars.get('GOOGLE_WORK_CALENDAR_ID', '')}

# Chat ID para notificações diárias
TELEGRAM_USER_CHAT_ID={env_vars.get('TELEGRAM_USER_CHAT_ID', '')}
"""

# Check if we need to remove old variables and add new ones
lines_to_keep = []
skip_next = False
old_keys = {
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_PERSONAL_CLIENT_ID', 'GOOGLE_PERSONAL_CLIENT_SECRET', 'GOOGLE_PERSONAL_REDIRECT_URI',
    'GOOGLE_PERSONAL_REFRESH_TOKEN', 'GOOGLE_PERSONAL_CALENDAR_ID',
    'GOOGLE_WORK_CLIENT_ID', 'GOOGLE_WORK_CLIENT_SECRET', 'GOOGLE_WORK_REDIRECT_URI',
    'GOOGLE_WORK_REFRESH_TOKEN', 'GOOGLE_WORK_CALENDAR_ID', 'TELEGRAM_USER_CHAT_ID',
}
for line in vps_env.splitlines():
    stripped = line.strip()
    # Skip old Google Calendar comment sections
    if stripped in ('#Pessoal', '#profissional', '# ===== Google Calendar Configuration =====',
                    '# Pessoal (juniormoises335@gmail.com)', '# Profissional (contato@kyrius.info)',
                    '# Chat ID para notificações diárias'):
        continue
    # Skip old key=value lines
    if '=' in stripped and not stripped.startswith('#'):
        key = stripped.split('=', 1)[0].strip()
        if key in old_keys:
            continue
    lines_to_keep.append(line)

new_env = '\n'.join(lines_to_keep).rstrip() + '\n' + google_block

# Write new .env to VPS
with sftp.open(f'{REMOTE_BASE}/.env', 'w') as f:
    f.write(new_env)
print('   ✅ .env updated on VPS')

sftp.close()

# ── Set executable permissions on shell scripts ───────────────────────────────
print('\n🔧 Setting permissions...')
cmds = [
    f'chmod +x {REMOTE_BASE}/.agents/skills/google-calendar-daily/scripts/setup_cron.sh',
    f'chmod +x {REMOTE_BASE}/.agents/skills/google-calendar-daily/scripts/fetch_daily.py',
    f'chmod +x {REMOTE_BASE}/.agents/skills/google-calendar-events/scripts/create_event.py',
    f'chmod +x {REMOTE_BASE}/.agents/skills/google-calendar-events/scripts/get_events.py',
]
for cmd in cmds:
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()

# ── Restart agent to reload skills ───────────────────────────────────────────
print('\n🔄 Restarting GueClaw agent...')
stdin, stdout, stderr = client.exec_command('pm2 restart gueclaw-agent && sleep 3 && pm2 status gueclaw-agent 2>&1')
out = stdout.read().decode()
print(out[:1000])

# ── Quick dry-run test on VPS ─────────────────────────────────────────────────
print('\n🧪 Quick dry-run test on VPS...')
test_cmd = (
    f'cd {REMOTE_BASE} && set -a && . .env && set +a && '
    f'python3 .agents/skills/google-calendar-daily/scripts/fetch_daily.py --dry-run 2>&1'
)
stdin, stdout, stderr = client.exec_command(test_cmd, timeout=30)
out = stdout.read().decode()
print(out[:2000])

client.close()
print('\n✅ Deploy complete! Skills deployed and agent restarted.')
print('   Next: run `python3 scripts/generate-google-token.py` to get the work refresh token.')
