# GueClaw Agent - Installation Script for VPS

# Exit on error
set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║     🤖 GueClaw Agent - VPS Installation         ║"
echo "║     Automated setup script                       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "⚠️  Please run as root (use sudo)"
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20 (if not installed)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install Docker (if not installed)
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | bash -
    systemctl enable docker
    systemctl start docker
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Clone repository (if not already cloned)
INSTALL_DIR="/opt/gueclaw-agent"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "📥 Cloning GueClaw repository..."
    echo "⚠️  Please enter your GitHub repository URL:"
    read -p "Repository URL: " REPO_URL
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "✅ Repository already exists at $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup environment variables
if [ ! -f ".env" ]; then
    echo "⚙️  Setting up environment variables..."
    cp .env.example .env
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 Please provide the following information:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    read -p "Telegram Bot Token: " BOT_TOKEN
    read -p "Telegram User IDs (comma-separated): " USER_IDS
    read -p "DeepSeek API Key: " DEEPSEEK_KEY
    
    # Update .env file
    sed -i "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$BOT_TOKEN/" .env
    sed -i "s/TELEGRAM_ALLOWED_USER_IDS=.*/TELEGRAM_ALLOWED_USER_IDS=$USER_IDS/" .env
    sed -i "s/DEEPSEEK_API_KEY=.*/DEEPSEEK_API_KEY=$DEEPSEEK_KEY/" .env
    sed -i "s/VPS_HOST=.*/VPS_HOST=localhost/" .env
    
    echo "✅ Environment variables configured"
else
    echo "⚠️  .env file already exists. Skipping configuration."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data tmp logs .agents/skills

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Setup PM2
echo "⚙️  Setting up PM2..."
pm2 delete gueclaw-agent 2>/dev/null || true
pm2 start dist/index.js --name gueclaw-agent
pm2 save
pm2 startup

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     ✅ Installation Complete!                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "🎉 GueClaw Agent is now running!"
echo ""
echo "📊 Check status:"
echo "   pm2 status"
echo ""
echo "📜 View logs:"
echo "   pm2 logs gueclaw-agent"
echo ""
echo "🔄 Restart:"
echo "   pm2 restart gueclaw-agent"
echo ""
echo "🛑 Stop:"
echo "   pm2 stop gueclaw-agent"
echo ""
echo "💬 Open Telegram and send /start to your bot!"
echo ""
