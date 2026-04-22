#!/usr/bin/env bash
#
# GueClaw Agent - Update Script
# 
# Usage: ./scripts/update.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Log functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "\n${CYAN}▸${NC} $1\n"; }

# Banner
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             GueClaw Agent - Update                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the gueclaw directory
if [ ! -f "package.json" ] || ! grep -q "gueclaw-agent" package.json; then
  log_error "Not in GueClaw directory. Please cd to gueclaw-agent first."
  exit 1
fi

# Check git status
if ! git status &> /dev/null; then
  log_error "Not a git repository. Please reinstall GueClaw."
  exit 1
fi

# Backup .env
log_step "Backing up configuration..."
if [ -f ".env" ]; then
  cp .env .env.backup
  log_success "Configuration backed up to .env.backup"
else
  log_warning "No .env file found"
fi

# Check for local changes
log_step "Checking for local changes..."
if git diff-index --quiet HEAD --; then
  log_success "No local changes detected"
else
  log_warning "Local changes detected"
  read -rp "Stash local changes? (Y/n) " -n 1
  echo ""
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    git stash push -m "GueClaw auto-stash before update $(date +%Y%m%d-%H%M%S)"
    log_success "Changes stashed"
  fi
fi

# Fetch updates
log_step "Fetching updates from GitHub..."
git fetch origin

# Check if updates available
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  log_success "Already up-to-date ($(git rev-parse --short HEAD))"
  exit 0
fi

# Show what changed
log_info "New commits available:"
git log --oneline --decorate --graph HEAD..@{u} | head -10

echo ""
read -rp "Apply updates? (Y/n) " -n 1
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
  log_info "Update cancelled"
  exit 0
fi

# Pull updates
log_step "Pulling updates..."
git pull origin main
log_success "Code updated"

# Update dependencies
log_step "Updating dependencies..."
npm install
log_success "Dependencies updated"

# Build
log_step "Building TypeScript..."
npm run build
log_success "Build completed"

# Restore .env if it was overwritten
if [ -f ".env.backup" ]; then
  if [ ! -f ".env" ]; then
    cp .env.backup .env
    log_success "Configuration restored from backup"
  else
    log_warning ".env file exists. Compare with .env.backup if needed."
  fi
fi

# Restart PM2 if running
log_step "Restarting services..."
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q "gueclaw-agent"; then
    pm2 restart gueclaw-agent
    log_success "PM2 process restarted"
  else
    log_info "PM2 process not found. Start manually with: pm2 start dist/index.js --name gueclaw-agent"
  fi
else
  log_info "PM2 not installed. Restart manually with: npm start"
fi

# Show new version
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Update Complete! 🎉                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Updated to: $(git describe --tags --always)"
log_info "Check logs: pm2 logs gueclaw-agent"
echo ""
