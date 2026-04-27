#!/bin/bash
# Mayan EDMS Deployment Script - GueClaw Agent
# Data: 25/04/2026

set -e

echo "🚀 Mayan EDMS Deployment Script"
echo "================================"

# Configuration
VPS_HOST="147.93.69.211"
VPS_USER="root"
SSH_KEY="$HOME/.ssh/gueclaw_vps"
MAYAN_DIR="/opt/mayan-edms"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    log_error "SSH key not found: $SSH_KEY"
    echo "Please create or update SSH_KEY variable"
    exit 1
fi

# Generate secure random passwords
log_info "Generating secure passwords..."
MAYAN_DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
MAYAN_RABBITMQ_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
MAYAN_SECRET_KEY=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
MAYAN_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo ""
echo "📝 Generated Credentials (SAVE THESE!):"
echo "======================================="
echo "MAYAN_DB_PASSWORD=$MAYAN_DB_PASSWORD"
echo "MAYAN_RABBITMQ_PASSWORD=$MAYAN_RABBITMQ_PASSWORD"
echo "MAYAN_SECRET_KEY=$MAYAN_SECRET_KEY"
echo "MAYAN_ADMIN_PASSWORD=$MAYAN_ADMIN_PASSWORD"
echo ""

# Save credentials to local file
cat > .env.mayan <<EOF
# Mayan EDMS Credentials - Generated $(date +%F)
MAYAN_DB_PASSWORD=$MAYAN_DB_PASSWORD
MAYAN_RABBITMQ_PASSWORD=$MAYAN_RABBITMQ_PASSWORD
MAYAN_SECRET_KEY=$MAYAN_SECRET_KEY
MAYAN_ADMIN_PASSWORD=$MAYAN_ADMIN_PASSWORD
EOF

log_info "Credentials saved to .env.mayan"

# NOTE: Remote SSH deployment disabled for Windows.
# To deploy Mayan EDMS on your VPS, follow these manual steps:
#   1. Transfer the generated .env.mayan file to the VPS (e.g., using scp).
#   2. SSH into the VPS and create the required directories:
#        sudo mkdir -p /opt/mayan-edms/{postgres,redis,media,config,rabbitmq}
#        sudo chown -R 1000:1000 /opt/mayan-edms
#   3. Ensure Docker network exists (or create it):
#        docker network create gueclaw-network
#   4. Place docker-compose.yml in /opt/mayan-edms and run:
#        cd /opt/mayan-edms && docker-compose pull && docker-compose up -d
#   5. Wait a few minutes, then check logs:
#        docker-compose logs -f
# The script will stop after generating credentials locally.
exit 0

# Wait for Mayan to initialize
log_info "Waiting for Mayan EDMS to initialize (60 seconds)..."
sleep 60

# Get API Token instructions
log_info "=========================================="
log_info "NEXT STEPS:"
log_info "=========================================="
echo "1. Access https://docs.kyrius.com.br"
echo "2. Login with:"
echo "   Username: admin"
echo "   Password: $MAYAN_ADMIN_PASSWORD"
echo ""
echo "3. Generate API Token:"
echo "   - Go to Admin > API > Tokens"
echo "   - Click 'Create' and select user 'admin'"
echo "   - Copy the generated token"
echo ""
echo "4. Update .env file:"
echo "   MAYAN_API_URL=https://docs.kyrius.com.br/api"
echo "   MAYAN_API_TOKEN=<your_token_here>"
echo ""
echo "5. Test connection:"
echo "   curl -H 'Authorization: Token <your_token>' https://docs.kyrius.com.br/api/"
echo ""
log_info "Credentials saved in .env.mayan - KEEP THIS FILE SECURE!"
