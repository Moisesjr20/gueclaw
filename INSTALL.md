# 🚀 GueClaw Agent - Quick Install Guide

## One-Line Installation

Install GueClaw Agent on your VPS with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/Moisesjr20/gueclaw/main/scripts/install.sh | bash
```

This will:
- ✅ Check prerequisites (Node.js 20+, npm, git)
- ✅ Clone the repository
- ✅ Install dependencies
- ✅ Build TypeScript
- ✅ Run configuration wizard
- ✅ Setup PM2 (process manager)
- ✅ Configure auto-start on boot

---

## Manual Installation

If you prefer manual installation:

### 1. Prerequisites

- **Node.js** 20+ ([install](https://nodejs.org/))
- **npm** (comes with Node.js)
- **git**
- **PM2** (optional but recommended): `npm install -g pm2`

### 2. Clone Repository

```bash
git clone https://github.com/Moisesjr20/gueclaw.git
cd gueclaw
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build

```bash
npm run build
```

### 5. Configure

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
nano .env
```

**Required**:
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/BotFather)
- `TELEGRAM_ALLOWED_USER_IDS` - Your Telegram user ID
- At least one LLM provider API key

**LLM Providers** (choose at least one):

| Provider | API Key | Model | Cost | Recommendation |
|----------|---------|-------|------|----------------|
| **GitHub Copilot** | `GITHUB_COPILOT_USE_OAUTH=true` | claude-sonnet-4.5, gpt-5.4 | $10/mo (Pro) | ⭐ Recommended |
| **DeepSeek** | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner | $0.14-0.55/M tokens | 💰 Cheap |
| **OpenRouter** | `OPENROUTER_API_KEY` | 200+ models | Pay-as-you-go | 🔀 Flexible |
| **Anthropic** | `ANTHROPIC_API_KEY` | claude-opus-4-7, claude-sonnet-4-6 | $3-15/M tokens | 🧠 Powerful |
| **Gemini** | `GEMINI_API_KEY` | gemini-3-pro-preview | Free tier | 🆓 Free option |
| **OpenAI** | `OPENAI_API_KEY` | gpt-5.4, gpt-5.3-codex | $0.50-15/M tokens | 🏢 Enterprise |

### 6. Authentication

If using GitHub Copilot OAuth:

```bash
npm run copilot:auth
```

Follow the device code flow to authenticate.

### 7. Start

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# With PM2 (recommended for VPS)
pm2 start dist/index.js --name gueclaw-agent
pm2 save
pm2 startup
```

---

## Smart Model Routing

GueClaw automatically chooses the best model for each task:

- **Simple tasks** (greetings, quick questions) → Fast/cheap model (DeepSeek Fast)
- **Complex tasks** (coding, debugging, analysis) → Powerful model (GitHub Copilot)

Enable in `.env`:

```bash
SMART_ROUTING_ENABLED=true
SMART_ROUTING_CHEAP_PROVIDER=deepseek
SMART_ROUTING_CHEAP_MODEL=deepseek-chat
SMART_ROUTING_MAX_CHARS=160
SMART_ROUTING_MAX_WORDS=28
```

---

## Configuration Examples

### Best: GitHub Copilot + DeepSeek (Hybrid)
```bash
# Primary: GitHub Copilot (for complex tasks)
GITHUB_COPILOT_USE_OAUTH=true
GITHUB_COPILOT_MODEL=claude-sonnet-4.5

# Fallback: DeepSeek (for simple tasks)
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL_FAST=deepseek-chat

# Smart routing
SMART_ROUTING_ENABLED=true
SMART_ROUTING_CHEAP_PROVIDER=deepseek
SMART_ROUTING_CHEAP_MODEL=deepseek-chat
```

### Budget: DeepSeek Only
```bash
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL_FAST=deepseek-chat
DEEPSEEK_MODEL_REASONING=deepseek-reasoner

SMART_ROUTING_ENABLED=true
SMART_ROUTING_CHEAP_PROVIDER=deepseek
SMART_ROUTING_CHEAP_MODEL=deepseek-chat
```

### Flexible: OpenRouter (200+ Models)
```bash
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5

# Or any model from https://openrouter.ai/models
# OPENROUTER_MODEL=google/gemini-3-pro-preview
# OPENROUTER_MODEL=openai/gpt-5.4
# OPENROUTER_MODEL=deepseek/deepseek-chat
```

---

## Update GueClaw

Keep your installation up-to-date:

```bash
cd ~/gueclaw-agent
git pull origin main
npm install
npm run build
pm2 restart gueclaw-agent
```

Or use the update script:

```bash
./scripts/update.sh
```

---

## Troubleshooting

### Port already in use
```bash
# Change port in .env
PORT=3001
```

### PM2 not starting on boot
```bash
pm2 startup
# Follow the instructions to configure systemd/init.d
```

### GitHub Copilot authentication failed
```bash
# Re-authenticate
npm run copilot:auth

# Or use API key method instead
GITHUB_COPILOT_USE_OAUTH=false
GITHUB_COPILOT_API_KEY=sk-xxx
```

### Provider not found
```bash
# Check if API key is set
cat .env | grep API_KEY

# Test provider
npm run test:copilot
```

---

## Commands

```bash
# Development
npm run dev          # Start with auto-reload
npm run build        # Build TypeScript
npm run test         # Run tests

# Production
npm start            # Start agent
pm2 logs gueclaw-agent    # View logs
pm2 restart gueclaw-agent # Restart
pm2 stop gueclaw-agent    # Stop

# Utilities
npm run copilot:auth      # Authenticate GitHub Copilot
npm run errors:map        # Analyze error logs
npm run security:audit    # Security scan
```

---

## Support

- 📖 [Full Documentation](https://github.com/Moisesjr20/gueclaw)
- 🐛 [Report Issues](https://github.com/Moisesjr20/gueclaw/issues)
- 💬 [Telegram Discussion](https://t.me/gueclaw)

---

**Made with ❤️ by GueClaw Team**
