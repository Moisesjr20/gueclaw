#!/usr/bin/env python3
"""Deploy to VPS via SSH using key-based authentication."""
import paramiko
import sys
import os
from pathlib import Path

def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / '.env'
    env = {}
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()
    return env

def main():
    # Load configuration
    env = load_env()
    
    vps_host = env.get('VPS_HOST', '147.93.69.211')
    vps_user = env.get('VPS_USER', 'root')
    vps_port = int(env.get('VPS_PORT', '22'))
    ssh_key_path = env.get('VPS_SSH_KEY_PATH')
    
    if not ssh_key_path:
        print('❌ ERROR: VPS_SSH_KEY_PATH not found in .env')
        sys.exit(1)
    
    # Expand home directory
    ssh_key_path = os.path.expanduser(ssh_key_path)
    
    if not os.path.exists(ssh_key_path):
        print(f'❌ ERROR: SSH key not found at {ssh_key_path}')
        sys.exit(1)
    
    print(f'🔌 Connecting to {vps_user}@{vps_host}:{vps_port}...')
    print(f'🔑 Using SSH key: {ssh_key_path}')
    
    # Connect to VPS
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            vps_host,
            port=vps_port,
            username=vps_user,
            key_filename=ssh_key_path,
            timeout=15,
            look_for_keys=False,
            allow_agent=False
        )
        print('✅ SSH connected successfully')
    except Exception as e:
        print(f'❌ SSH connection failed: {e}')
        sys.exit(1)
    
    # Deploy commands
    commands = [
        'cd /opt/gueclaw-agent',
        'echo "📦 Pulling latest code from git..."',
        'git pull origin main',
        'echo "🔨 Installing dependencies..."',
        'npm install',
        'echo "🔨 Building project..."',
        'npm run build',
        'echo "🔄 Restarting bot with pm2..."',
        'pm2 restart gueclaw-agent',
        'echo "✅ DEPLOY_SUCCESS"'
    ]
    
    cmd = ' && '.join(commands)
    
    print('🚀 Executing deployment on VPS...')
    print('━' * 60)
    
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    
    # Read and display output in real-time
    for line in stdout:
        print(line.rstrip())
    
    # Check for errors
    stderr_output = stderr.read().decode('utf-8')
    if stderr_output:
        print('⚠️  STDERR output:')
        print(stderr_output[:2000])
    
    # Check exit status
    exit_status = stdout.channel.recv_exit_status()
    
    print('━' * 60)
    
    client.close()
    
    if exit_status == 0:
        print('\n✅ Deployment completed successfully!')
        print('🤖 Bot is now running with the latest changes')
    else:
        print(f'\n❌ Deployment failed with exit code {exit_status}')
        print('   Check the output above for details')
        sys.exit(1)

if __name__ == '__main__':
    main()
