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

# Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin main

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
