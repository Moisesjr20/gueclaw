#!/bin/bash
# GueClaw Agent - Update Script for VPS

# Exit on error
set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║     🔄 GueClaw Agent - Update Script            ║"
echo "║     Automated update from GitHub                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in GueClaw project directory"
    echo "💡 Run: cd /opt/gueclaw-agent"
    exit 1
fi

# Stop PM2 process
echo "🛑 Stopping PM2 process..."
pm2 stop gueclaw-agent || true

# Pull latest code from GitHub (stash local changes se houver)
echo "📥 Pulling latest code from GitHub..."
git stash --include-untracked 2>/dev/null || true
git pull origin main

# Sync Obsidian vault
echo "📚 Syncing Obsidian vault..."
if [ -d "/opt/obsidian-vault" ]; then
  cd /opt/obsidian-vault && git pull origin main 2>&1 || echo "⚠️  Vault sync failed (continuing)"
  cd /opt/gueclaw-agent
else
  echo "⚠️  /opt/obsidian-vault not found — skipping vault sync"
fi

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Restart PM2 process
echo "🚀 Restarting PM2 process..."
pm2 restart gueclaw-agent

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     ✅ Update Complete!                         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "📊 Check status: pm2 status"
echo "📜 View logs: pm2 logs gueclaw-agent --lines 50"
echo ""
