#!/usr/bin/env bash
#
# GueClaw Agent - One-Line Installer
# 
# curl -fsSL https://raw.githubusercontent.com/Moisesjr20/gueclaw/main/scripts/install.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
show_banner() {
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║                                                            ║${NC}"
  echo -e "${CYAN}║     ${GREEN}███╗   ██╗██╗   ██╗███████╗ ██████╗██╗      █████╗██╗    ██╗${NC}    ${CYAN}║${NC}"
  echo -e "${CYAN}║     ${GREEN}████╗  ██║██║   ██║██╔════╝██╔════╝██║     ██╔══██╝██║    ██║${NC}    ${CYAN}║${NC}"
  echo -e "${CYAN}║     ${GREEN}██╔██╗ ██║██║   ██║█████╗  ██║     ██║     ███████║██║ █╗ ██║${NC}    ${CYAN}║${NC}"
  echo -e "${CYAN}║     ${GREEN}██║╚██╗██║██║   ██║██╔══╝  ██║     ██║     ██╔══██║██║███╗██║${NC}    ${CYAN}║${NC}"
  echo -e "${CYAN}║     ${GREEN}██║ ╚████║╚██████╔╝███████╗╚██████╗███████╗██║  ██║╚███╔███╔╝${NC}    ${CYAN}║${NC}"
  echo -e "${CYAN}║     ${GREEN}╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝${NC}     ${CYAN}║${NC}"
  echo -e "${CYAN}║                                                            ║${NC}"
  echo -e "${CYAN}║          ${YELLOW}Personal AI Agent for VPS with Telegram${NC}          ${CYAN}║${NC}"
  echo -e "${CYAN}║                      ${BLUE}v2.2.0${NC}                           ${CYAN}║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# Log functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "\n${CYAN}▸${NC} $1\n"; }

# Detect OS and platform
detect_platform() {
  local os
  os="$(uname -s)"
  
  case "$os" in
    Linux*)
      if [ -d "/data/data/com.termux" ]; then
        echo "termux"
      else
        echo "linux"
      fi
      ;;
    Darwin*)
      echo "macos"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "wsl"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

# Check prerequisites
check_prerequisites() {
  log_step "Checking prerequisites..."
  
  local missing=()
  
  # Check Node.js
  if ! command -v node &> /dev/null; then
    missing+=("Node.js (v20+)")
  else
    local node_version
    node_version="$(node -v | cut -d'v' -f2 | cut -d'.' -f1)"
    if [ "$node_version" -lt 20 ]; then
      log_warning "Node.js $node_version detected. Node.js 20+ recommended."
    else
      log_success "Node.js $(node -v) detected"
    fi
  fi
  
  # Check npm
  if ! command -v npm &> /dev/null; then
    missing+=("npm")
  else
    log_success "npm $(npm -v) detected"
  fi
  
  # Check Git
  if ! command -v git &> /dev/null; then
    missing+=("git")
  else
    log_success "git $(git --version | cut -d' ' -f3) detected"
  fi
  
  # Check PM2 (optional but recommended)
  if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 not installed (optional but recommended for production)"
  else
    log_success "PM2 detected"
  fi
  
  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing dependencies: ${missing[*]}"
    echo ""
    echo "Install instructions:"
    echo "  Ubuntu/Debian: sudo apt-get install nodejs npm git"
    echo "  macOS:         brew install node git"
    echo "  Windows:       Use WSL2 (Windows Subsystem for Linux)"
    echo ""
    exit 1
  fi
}

# Install GueClaw
install_gueclaw() {
  log_step "Installing GueClaw Agent..."
  
  local install_dir="${GUECLAW_INSTALL_DIR:-$HOME/gueclaw-agent}"
  
  # Check if already installed
  if [ -d "$install_dir" ]; then
    log_warning "GueClaw already installed at $install_dir"
    read -rp "Update existing installation? (y/N) " -n 1
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Installation cancelled"
      exit 0
    fi
    cd "$install_dir"
    git pull origin main
  else
    log_info "Cloning GueClaw repository..."
    git clone https://github.com/Moisesjr20/gueclaw.git "$install_dir"
    cd "$install_dir"
  fi
  
  log_info "Installing dependencies..."
  npm install --production
  
  log_info "Building TypeScript..."
  npm run build
  
  log_success "GueClaw installed successfully!"
  echo "  Location: $install_dir"
}

# Setup configuration
setup_config() {
  log_step "Setting up configuration..."
  
  if [ -f ".env" ]; then
    log_warning ".env file already exists"
    read -rp "Overwrite with setup wizard? (y/N) " -n 1
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Keeping existing configuration"
      return
    fi
  fi
  
  log_info "Starting configuration wizard..."
  echo ""
  
  # Create .env from example
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    touch .env
  fi
  
  # Telegram Bot Token
  echo -e "${CYAN}1. Telegram Bot Setup${NC}"
  echo "   Get your bot token from @BotFather on Telegram"
  read -rp "   Telegram Bot Token: " telegram_token
  if [ -n "$telegram_token" ]; then
    sed -i.bak "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$telegram_token/" .env
  fi
  
  # Telegram Allowed Users
  read -rp "   Your Telegram User ID: " telegram_user_id
  if [ -n "$telegram_user_id" ]; then
    sed -i.bak "s/TELEGRAM_ALLOWED_USER_IDS=.*/TELEGRAM_ALLOWED_USER_IDS=$telegram_user_id/" .env
  fi
  
  echo ""
  
  # LLM Provider Selection
  echo -e "${CYAN}2. LLM Provider Selection${NC}"
  echo "   Choose your preferred provider:"
  echo "   1) OpenRouter (Recommended - 200+ models, CoT Routing com 7 especialistas)"
  echo "   2) DeepSeek (Fast e barato)"
  echo "   3) Anthropic Claude (Direto)"
  echo "   4) Google Gemini"
  echo "   5) OpenAI"
  echo "   6) GitHub Copilot (OAuth)"
  read -rp "   Choice (1-6): " llm_choice

  case "$llm_choice" in
    1)
      read -rp "   OpenRouter API Key (sk-or-...): " openrouter_key
      cat >> .env << EOF

# OpenRouter — gateway unificado para todos os modelos especialistas
OPENROUTER_API_KEY=$openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=deepseek/deepseek-r1
EOF

      # CoT Routing setup
      echo ""
      echo -e "${CYAN}3. CoT Routing (DeepSeek R1 classifica cada mensagem para 7 especialistas)${NC}"
      read -rp "   Ativar CoT Routing automático? (Y/n) " -n 1
      echo ""
      if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        cat >> .env << EOF

# CoT Routing — triage inteligente via DeepSeek R1
ROUTER_COT_ENABLED=true
ROUTER_TRIAGE_MODEL=deepseek/deepseek-r1

# Modelos especialistas por categoria (padrões recomendados)
ROUTER_MODEL_REASONING=deepseek/deepseek-r1
ROUTER_MODEL_AGENTIC=moonshotai/kimi-k2
ROUTER_MODEL_TEXT=qwen/qwen3-235b-a22b
ROUTER_MODEL_FAST=google/gemma-3-27b-it
ROUTER_MODEL_LONGOUTPUT=thudm/glm-z1-32b
ROUTER_MODEL_CODE=deepseek/deepseek-r1
ROUTER_MODEL_FALLBACK=deepseek/deepseek-chat-v3-0324
EOF
        log_success "CoT Routing ativado com 7 modelos especialistas"
      else
        echo "ROUTER_COT_ENABLED=false" >> .env
        log_info "CoT Routing desativado — usando heurística local"
      fi
      ;;
    2)
      read -rp "   DeepSeek API Key: " deepseek_key
      sed -i.bak "s/DEEPSEEK_API_KEY=.*/DEEPSEEK_API_KEY=$deepseek_key/" .env
      ;;
    3)
      read -rp "   Anthropic API Key: " anthropic_key
      cat >> .env << EOF

# Anthropic Configuration
ANTHROPIC_API_KEY=$anthropic_key
ANTHROPIC_MODEL=claude-sonnet-4-6
EOF
      ;;
    4)
      read -rp "   Google AI API Key: " gemini_key
      cat >> .env << EOF

# Google Gemini Configuration
GEMINI_API_KEY=$gemini_key
GEMINI_MODEL=gemini-2.0-flash
EOF
      ;;
    5)
      read -rp "   OpenAI API Key: " openai_key
      sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" .env
      sed -i.bak "s/OPENAI_MODEL=.*/OPENAI_MODEL=gpt-4o/" .env
      ;;
    6)
      echo "   GitHub Copilot setup:"
      echo "   - Execute 'npm run copilot:auth' após a instalação para autenticar"
      sed -i.bak "s/GITHUB_COPILOT_USE_OAUTH=.*/GITHUB_COPILOT_USE_OAUTH=true/" .env
      sed -i.bak "s/GITHUB_COPILOT_MODEL=.*/GITHUB_COPILOT_MODEL=claude-sonnet-4.5/" .env
      ;;
  esac

  echo ""

  # RAG Setup (optional)
  echo -e "${CYAN}4. RAG Profundo — Busca semântica em documentos (PostgreSQL + pgvector)${NC}"
  echo "   Requer Docker instalado e rodando."
  read -rp "   Ativar RAG? (y/N) " -n 1
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -rp "   Senha do PostgreSQL RAG: " rag_password
    if [ -z "$rag_password" ]; then
      rag_password="changeme_$(date +%s)"
    fi
    cat >> .env << EOF

# RAG Profundo — PostgreSQL + pgvector
RAG_POSTGRES_URL=postgresql://gueclaw:${rag_password}@localhost:5433/gueclaw_rag
RAG_DOCUMENTS_DIR=./data/documents
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_TOP_K=5
EOF
    # Update docker-compose password
    if [ -f "deploy/postgres-rag/docker-compose.yml" ]; then
      sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${rag_password}/" deploy/postgres-rag/docker-compose.yml
      rm -f deploy/postgres-rag/docker-compose.yml.bak
    fi
    log_success "RAG configurado — suba o PostgreSQL com:"
    echo "     docker compose -f deploy/postgres-rag/docker-compose.yml up -d"
    SETUP_RAG=true
  else
    log_info "RAG desativado — você pode ativar depois editando o .env"
    SETUP_RAG=false
  fi

  log_success "Configuração salva em .env"
  rm -f .env.bak
}

# Setup PM2 (optional)
setup_pm2() {
  if ! command -v pm2 &> /dev/null; then
    read -rp "Install PM2 for process management? (Y/n) " -n 1
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      npm install -g pm2
      log_success "PM2 installed globally"
    fi
  fi
  
  if command -v pm2 &> /dev/null; then
    log_info "Setting up PM2..."
    pm2 delete gueclaw-agent 2>/dev/null || true
    pm2 start dist/index.js --name gueclaw-agent
    pm2 save
    pm2 startup
    log_success "PM2 configured. GueClaw will start on boot."
  fi
}

# Post-install instructions
show_next_steps() {
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                            ║${NC}"
  echo -e "${GREEN}║              Installation Complete! 🎉                      ║${NC}"
  echo -e "${GREEN}║                                                            ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Next Steps:${NC}"
  echo ""
  echo "  1. Suba o PostgreSQL RAG (se ativado):"
  echo "     docker compose -f deploy/postgres-rag/docker-compose.yml up -d"

  if grep -q "GITHUB_COPILOT_USE_OAUTH=true" .env 2>/dev/null; then
    echo ""
    echo "  2. Autentique o GitHub Copilot:"
    echo "     cd ~/gueclaw-agent && npm run copilot:auth"
  fi

  echo ""
  echo "  3. Inicie o GueClaw:"
  if command -v pm2 &> /dev/null; then
    echo "     pm2 logs gueclaw-agent    # Ver logs"
    echo "     pm2 restart gueclaw-agent # Reiniciar"
    echo "     pm2 stop gueclaw-agent    # Parar"
  else
    echo "     npm start"
    echo "     # ou em desenvolvimento:"
    echo "     npm run dev"
  fi

  echo ""
  echo "  4. Envie uma mensagem para o seu bot no Telegram!"
  echo ""
  echo -e "${CYAN}Useful Commands:${NC}"
  echo "  /start   - Start conversation"
  echo "  /help    - Show available commands"
  echo "  /version - Show version"
  echo "  /status  - System status"
  echo ""
  echo -e "${CYAN}Documentation:${NC}"
  echo "  https://github.com/Moisesjr20/gueclaw"
  echo ""
  echo -e "${CYAN}Support:${NC}"
  echo "  Issues: https://github.com/Moisesjr20/gueclaw/issues"
  echo ""
}

# Main installation flow
main() {
  show_banner
  
  local platform
  platform="$(detect_platform)"
  
  log_info "Detected platform: $platform"
  
  if [ "$platform" = "unknown" ]; then
    log_error "Unsupported platform. Please install manually."
    exit 1
  fi
  
  if [ "$platform" = "wsl" ]; then
    log_warning "Detected Windows. Please use WSL2 for installation."
  fi
  
  check_prerequisites
  install_gueclaw
  setup_config
  setup_pm2
  show_next_steps
  
  log_success "GueClaw Agent is ready! 🚀"
}

# Handle Ctrl+C
trap 'echo ""; log_warning "Installation cancelled"; exit 1' INT

# Run main
main "$@"
