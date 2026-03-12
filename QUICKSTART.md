# GueClaw Agent - Quick Start Guide

## 🚀 Installation (One-Line)

### For VPS (Fresh Ubuntu/Debian):

```bash
curl -fsSL https://raw.githubusercontent.com/your-repo/gueclaw-agent/main/install.sh | sudo bash
```

### Manual Installation:

```bash
# 1. Clone
git clone https://github.com/your-repo/gueclaw-agent.git /opt/gueclaw-agent
cd /opt/gueclaw-agent

# 2. Install dependencies
npm install

# 3. Configure
cp .env.example .env
nano .env  # Fill in TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS, DEEPSEEK_API_KEY

# 4. Build
npm run build

# 5. Start
npm start

# Or with PM2:
pm2 start dist/index.js --name gueclaw-agent
pm2 save
pm2 startup
```

---

## ⚙️ Configuration Essentials

Minimum `.env` configuration:

```env
# Required
TELEGRAM_BOT_TOKEN=123456:ABC-DEFghIjklmnop
TELEGRAM_ALLOWED_USER_IDS=123456789
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxx

# Optional (with defaults)
MAX_ITERATIONS=5
MEMORY_WINDOW_SIZE=10
DEFAULT_PROVIDER=deepseek
```

---

## 💬 Basic Commands (Telegram)

```
/start    - Welcome message
/help     - Show help
/stats    - View agent stats
/reload   - Reload skills (hot-reload)
```

---

## 📝 Example Queries

### System Management
```
- Show disk usage
- List running processes
- Check system memory
- Update system packages
```

### Docker
```
- List all containers
- Show logs of container nginx
- Restart container web-app
- Pull image postgres:latest
```

### Files
```
- Read file /etc/nginx/nginx.conf
- Create a file at /tmp/test.txt with content "Hello"
- List files in /var/www
- Delete /tmp/old-file.log
```

### Create Skills
```
- Create a skill for monitoring system load
- Create a skill for PostgreSQL backups
- Create a skill to interact with GitHub API
```

### API Requests
```
- Make a GET request to https://api.github.com/repos/torvalds/linux
- POST to https://httpbin.org/post with body {test: true}
```

---

## 🔍 Monitoring

### PM2
```bash
pm2 status                    # Check status
pm2 logs gueclaw-agent       # View logs
pm2 restart gueclaw-agent    # Restart
pm2 stop gueclaw-agent       # Stop
pm2 delete gueclaw-agent     # Remove
```

### Systemd
```bash
systemctl status gueclaw     # Check status
journalctl -u gueclaw -f     # View logs
systemctl restart gueclaw    # Restart
systemctl stop gueclaw       # Stop
```

---

## 🛠️ Troubleshooting

### Bot not responding?
```bash
# Check if running
pm2 status

# Check logs
pm2 logs gueclaw-agent --lines 50

# Restart
pm2 restart gueclaw-agent
```

### Permission errors?
```bash
# Ensure running as root or with sudo
sudo pm2 start dist/index.js --name gueclaw-agent
```

### Out of memory?
```bash
# Check memory usage
free -h
docker stats

# Clean Docker
docker system prune -af

# Restart agent
pm2 restart gueclaw-agent
```

### Database locked?
```bash
# Check .env
grep ENABLE_WAL .env

# Should be: ENABLE_WAL=true

# Restart agent
pm2 restart gueclaw-agent
```

---

## 📊 Skills System

### View Loaded Skills
```
/stats  (in Telegram)
```

### Reload Skills
```
/reload  (in Telegram)
```

### Create New Skill
```
📱 You: Create a skill for [your use case]

🤖 Bot: [Creates skill automatically using self-improvement]
```

### Manual Skill Creation

1. Create directory:
```bash
mkdir -p .agents/skills/my-skill
```

2. Create `SKILL.md`:
```yaml
---
name: my-skill
description: What my skill does
version: 1.0.0
author: You
category: automation
tools:
  - vps_execute_command
  - file_operations
---

# My Skill

## Purpose
...

## Instructions
...
```

3. Reload:
```
/reload  (in Telegram)
```

---

## 🔒 Security Best Practices

1. **Whitelist Users**: Only add trusted Telegram user IDs
2. **Use SSH Keys**: Configure `VPS_SSH_KEY_PATH` instead of passwords
3. **Rotate API Keys**: Periodically update DeepSeek API key
4. **Monitor Logs**: Check logs regularly for suspicious activity
5. **Update System**: Keep VPS packages updated
6. **Backup Database**: Backup `data/gueclaw.db` regularly

---

## 📦 Backup & Restore

### Backup
```bash
# Backup database
cp data/gueclaw.db backups/gueclaw-$(date +%Y%m%d).db

# Backup skills
tar -czf backups/skills-$(date +%Y%m%d).tar.gz .agents/skills/

# Backup config
cp .env backups/.env-$(date +%Y%m%d)
```

### Restore
```bash
# Restore database
cp backups/gueclaw-20260312.db data/gueclaw.db

# Restore skills
tar -xzf backups/skills-20260312.tar.gz

# Restart
pm2 restart gueclaw-agent
```

---

## 🆙 Updating

```bash
cd /opt/gueclaw-agent

# Stop agent
pm2 stop gueclaw-agent

# Pull latest code
git pull origin main

# Install dependencies (if changed)
npm install

# Rebuild
npm run build

# Restart
pm2 restart gueclaw-agent
```

---

## 📞 Support

- **GitHub Issues**: Report bugs
- **GitHub Discussions**: Ask questions
- **Documentation**: [Full README](README.md)

---

## ✅ Health Check

Run this to verify everything is working:

```bash
# Check Node.js
node --version  # Should be v20+

# Check bot status
pm2 status | grep gueclaw

# Check database
ls -lh data/gueclaw.db

# Check skills
ls -la .agents/skills/

# Check logs for errors
pm2 logs gueclaw-agent --lines 20 --nostream | grep -i error

# Send test message in Telegram
# /start
```

Expected response: Bot should reply with welcome message

---

**🎉 You're all set! Enjoy your GueClaw Agent!**
