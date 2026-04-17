#!/bin/bash
# 🧪 E2E Test Helper - Hermes Features
# Execute este script para gerar comandos de teste prontos para copiar/colar no Telegram

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🧪 TESTES E2E - HERMES FEATURES v2.0.0                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Copie e cole os comandos abaixo no Telegram:${NC}"
echo ""

# ========================================
# 1. Context Files
# ========================================
echo -e "${YELLOW}1️⃣  Feature 1.1: Context Files${NC}"
echo ""
echo "/context show"
echo "/context reload"
echo "/context add README.md"
echo ""
read -p "✅ Pressione ENTER após testar Context Files..."

# ========================================
# 2. Slash Commands
# ========================================
echo ""
echo -e "${YELLOW}2️⃣  Feature 1.2: Slash Commands${NC}"
echo ""
echo "/help"
echo "/version"
echo "/status"
echo ""
read -p "✅ Pressione ENTER após testar Slash Commands..."

# ========================================
# 3. Cron Scheduler
# ========================================
echo ""
echo -e "${YELLOW}3️⃣  Feature 1.3: Cron Scheduler${NC}"
echo ""
echo "/cron list"
echo "/cron add \"0 9 * * *\" \"Relatório diário\""
echo "/cron list"
echo "/cron run 1"
echo "/cron remove 1"
echo "/cron list"
echo ""
read -p "✅ Pressione ENTER após testar Cron Scheduler..."

# ========================================
# 4. Auto-Improve Skills
# ========================================
echo ""
echo -e "${YELLOW}4️⃣  Feature 2.1: Auto-Improve Skills${NC}"
echo ""
echo "PASSO 1: Gerar falha (envie mensagem abaixo):"
echo "---"
echo "Use a skill nextjs para fazer deploy de uma aplicação Angular"
echo "---"
echo ""
read -p "⏸️  Aguarde resposta do GueClaw, depois pressione ENTER..."
echo ""
echo "PASSO 2: Executar auto-improve:"
echo "/improve nextjs"
echo ""
read -p "✅ Pressione ENTER após testar Auto-Improve..."

# ========================================
# 5. FTS5 Search
# ========================================
echo ""
echo -e "${YELLOW}5️⃣  Feature 2.2: FTS5 Session Search${NC}"
echo ""
echo "PASSO 1: Criar histórico de teste (envie as 3 mensagens abaixo):"
echo "---"
echo "Faça deploy no VPS 147.93.69.211"
echo "---"
echo "Configure nginx no servidor de produção"
echo "---"
echo "Restart do pm2 no ambiente de staging"
echo "---"
echo ""
read -p "⏸️  Aguarde respostas do GueClaw, depois pressione ENTER..."
echo ""
echo "PASSO 2: Executar buscas:"
echo "/search deploy VPS"
echo "/search nginx"
echo "/search restart pm2"
echo "/buscar servidor"
echo "/find produção"
echo ""
read -p "✅ Pressione ENTER após testar FTS5 Search..."

# ========================================
# 6. Subagentes Paralelos
# ========================================
echo ""
echo -e "${YELLOW}6️⃣  Feature 3.1: Subagentes Paralelos${NC}"
echo ""
echo "TESTE 1: Análise de múltiplos arquivos (copie mensagem abaixo):"
echo "---"
echo "Analise 3 arquivos em paralelo: README.md, package.json, e gueclaw.md. Para cada um, resuma o conteúdo em 2 linhas."
echo "---"
echo ""
read -p "⏸️  Aguarde resposta (pode demorar ~10s), depois pressione ENTER..."
echo ""
echo "TESTE 2: Comandos independentes (copie mensagem abaixo):"
echo "---"
echo "Execute esses comandos independentes: 1. Liste arquivos em src/, 2. Conte linhas de código em src/core/, 3. Verifique status do git"
echo "---"
echo ""
read -p "⏸️  Aguarde resposta, depois pressione ENTER..."
echo ""
echo "TESTE 3: Validação de segurança (copie mensagem abaixo):"
echo "---"
echo "Delegue task que tenta usar send_message para enviar uma mensagem no Telegram"
echo "---"
echo ""
read -p "✅ Pressione ENTER após testar Subagentes..."

# ========================================
# 7. Testes de Integração Cross-Feature
# ========================================
echo ""
echo -e "${YELLOW}🔄 Testes de Integração Cross-Feature${NC}"
echo ""
echo "TESTE 1: Context + Search"
echo "/context add README.md"
echo "---"
echo "Resuma o README.md que você acabou de carregar"
echo "---"
read -p "⏸️  Aguarde resposta, depois pressione ENTER..."
echo "/search README"
echo ""
read -p "✅ Pressione ENTER após validar integração..."

# ========================================
# 8. Testes de Regressão
# ========================================
echo ""
echo -e "${YELLOW}🔙 Testes de Regressão (Features Antigas)${NC}"
echo ""
echo "/start"
echo "/clear"
echo "/tasks"
echo "/cost"
echo ""
echo "Mensagem livre:"
echo "---"
echo "Oi GueClaw, tudo bem? Explique brevemente o que você faz."
echo "---"
echo ""
read -p "✅ Pressione ENTER após testar regressão..."

# ========================================
# Finalização
# ========================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ TESTES E2E COMPLETOS!                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📊 Próximos passos:"
echo "1. Preencha o registro de testes em E2E-TEST-PLAN-HERMES.md"
echo "2. Anote bugs encontrados (se houver)"
echo "3. Calcule taxa de sucesso: (features OK / 6) * 100"
echo ""
echo "📄 Documentação completa: E2E-TEST-PLAN-HERMES.md"
echo ""
