# 🧪 E2E Test Helper - Hermes Features (PowerShell)
# Execute: .\scripts\e2e-test-helper.ps1

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🧪 TESTES E2E - HERMES FEATURES v2.0.0                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Copie e cole os comandos abaixo no Telegram:" -ForegroundColor Blue
Write-Host ""

# ========================================
# 1. Context Files
# ========================================
Write-Host "1️⃣  Feature 1.1: Context Files" -ForegroundColor Yellow
Write-Host ""
Write-Host "/context show" -ForegroundColor White
Write-Host "/context reload" -ForegroundColor White
Write-Host "/context add README.md" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após testar Context Files"

# ========================================
# 2. Slash Commands
# ========================================
Write-Host ""
Write-Host "2️⃣  Feature 1.2: Slash Commands" -ForegroundColor Yellow
Write-Host ""
Write-Host "/help" -ForegroundColor White
Write-Host "/version" -ForegroundColor White
Write-Host "/status" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após testar Slash Commands"

# ========================================
# 3. Cron Scheduler
# ========================================
Write-Host ""
Write-Host "3️⃣  Feature 1.3: Cron Scheduler" -ForegroundColor Yellow
Write-Host ""
Write-Host "/cron list" -ForegroundColor White
Write-Host "/cron add `"0 9 * * *`" `"Relatório diário`"" -ForegroundColor White
Write-Host "/cron list" -ForegroundColor White
Write-Host "/cron run 1" -ForegroundColor White
Write-Host "/cron remove 1" -ForegroundColor White
Write-Host "/cron list" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após testar Cron Scheduler"

# ========================================
# 4. Auto-Improve Skills
# ========================================
Write-Host ""
Write-Host "4️⃣  Feature 2.1: Auto-Improve Skills" -ForegroundColor Yellow
Write-Host ""
Write-Host "PASSO 1: Gerar falha (envie mensagem abaixo):" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Use a skill nextjs para fazer deploy de uma aplicação Angular" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "⏸️  Aguarde resposta do GueClaw, depois pressione ENTER"
Write-Host ""
Write-Host "PASSO 2: Executar auto-improve:" -ForegroundColor Cyan
Write-Host "/improve nextjs" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após testar Auto-Improve"

# ========================================
# 5. FTS5 Search
# ========================================
Write-Host ""
Write-Host "5️⃣  Feature 2.2: FTS5 Session Search" -ForegroundColor Yellow
Write-Host ""
Write-Host "PASSO 1: Criar histórico de teste (envie as 3 mensagens abaixo):" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Faça deploy no VPS 147.93.69.211" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Configure nginx no servidor de produção" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Restart do pm2 no ambiente de staging" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "⏸️  Aguarde respostas do GueClaw, depois pressione ENTER"
Write-Host ""
Write-Host "PASSO 2: Executar buscas:" -ForegroundColor Cyan
Write-Host "/search deploy VPS" -ForegroundColor White
Write-Host "/search nginx" -ForegroundColor White
Write-Host "/search restart pm2" -ForegroundColor White
Write-Host "/buscar servidor" -ForegroundColor White
Write-Host "/find produção" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após testar FTS5 Search"

# ========================================
# 6. Subagentes Paralelos
# ========================================
Write-Host ""
Write-Host "6️⃣  Feature 3.1: Subagentes Paralelos" -ForegroundColor Yellow
Write-Host ""
Write-Host "TESTE 1: Análise de múltiplos arquivos (copie mensagem abaixo):" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Analise 3 arquivos em paralelo: README.md, package.json, e gueclaw.md. Para cada um, resuma o conteúdo em 2 linhas." -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "⏸️  Aguarde resposta (pode demorar ~10s), depois pressione ENTER"
Write-Host ""
Write-Host "TESTE 2: Comandos independentes (copie mensagem abaixo):" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Execute esses comandos independentes: 1. Liste arquivos em src/, 2. Conte linhas de código em src/core/, 3. Verifique status do git" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "⏸️  Aguarde resposta, depois pressione ENTER"
Write-Host ""
Write-Host "TESTE 3: Validação de segurança (copie mensagem abaixo):" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Delegue task que tenta usar send_message para enviar uma mensagem no Telegram" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "✅ Pressione ENTER após testar Subagentes"

# ========================================
# 7. Testes de Integração Cross-Feature
# ========================================
Write-Host ""
Write-Host "🔄 Testes de Integração Cross-Feature" -ForegroundColor Yellow
Write-Host ""
Write-Host "TESTE 1: Context + Search" -ForegroundColor Cyan
Write-Host "/context add README.md" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Resuma o README.md que você acabou de carregar" -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Read-Host "⏸️  Aguarde resposta, depois pressione ENTER"
Write-Host "/search README" -ForegroundColor White
Write-Host ""
Read-Host "✅ Pressione ENTER após validar integração"

# ========================================
# 8. Testes de Regressão
# ========================================
Write-Host ""
Write-Host "🔙 Testes de Regressão (Features Antigas)" -ForegroundColor Yellow
Write-Host ""
Write-Host "/start" -ForegroundColor White
Write-Host "/clear" -ForegroundColor White
Write-Host "/tasks" -ForegroundColor White
Write-Host "/cost" -ForegroundColor White
Write-Host ""
Write-Host "Mensagem livre:" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor DarkGray
Write-Host "Oi GueClaw, tudo bem? Explique brevemente o que você faz." -ForegroundColor White
Write-Host "---" -ForegroundColor DarkGray
Write-Host ""
Read-Host "✅ Pressione ENTER após testar regressão"

# ========================================
# Finalização
# ========================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ TESTES E2E COMPLETOS!                                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Preencha o registro de testes em E2E-TEST-PLAN-HERMES.md" -ForegroundColor White
Write-Host "2. Anote bugs encontrados (se houver)" -ForegroundColor White
Write-Host "3. Calcule taxa de sucesso: (features OK / 6) * 100" -ForegroundColor White
Write-Host ""
Write-Host "📄 Documentação completa: E2E-TEST-PLAN-HERMES.md" -ForegroundColor Cyan
Write-Host ""
