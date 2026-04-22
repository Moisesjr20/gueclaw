# Script PowerShell para Deploy da Correção ACTION-FIRST
# Uso: .\scripts\deploy-fix.ps1

Write-Host "🚀 DEPLOY - Correção System Prompt ACTION-FIRST" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "src/core/agent-loop/agent-loop.ts")) {
    Write-Host "❌ Erro: Execute este script a partir da raiz do projeto" -ForegroundColor Red
    Write-Host "   cd 'd:\Clientes de BI\projeto GueguelClaw'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Diretório correto" -ForegroundColor Green

# 1. Verificar se há mudanças não commitadas
Write-Host ""
Write-Host "📋 Verificando mudanças..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "✅ Mudanças detectadas:" -ForegroundColor Green
    git status --short
} else {
    Write-Host "⚠️  Nenhuma mudança detectada" -ForegroundColor Yellow
    exit 0
}

# 2. Confirmar deploy
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Isso irá:" -ForegroundColor Yellow
Write-Host "   1. Commitar as mudanças" -ForegroundColor White
Write-Host "   2. Fazer push para origin/main" -ForegroundColor White
Write-Host "   3. Fazer deploy na VPS (SSH necessário)" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continuar? (s/N)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "❌ Deploy cancelado" -ForegroundColor Red
    exit 0
}

# 3. Git add
Write-Host ""
Write-Host "📦 Adicionando arquivos ao Git..." -ForegroundColor Yellow
git add src/core/agent-loop/agent-loop.ts
git add DIAGNOSTICO-ERROS-22-04-2026.md
git add CORRECAO-SYSTEM-PROMPT.md
git add GUIA-RAPIDO-RESOLUCAO.md
git add scripts/diagnostico-logs.sh
git add scripts/deploy-fix.ps1

Write-Host "✅ Arquivos adicionados" -ForegroundColor Green

# 4. Git commit
Write-Host ""
Write-Host "💾 Criando commit..." -ForegroundColor Yellow
$commitMsg = "fix: implement ACTION-FIRST system prompt to force immediate tool execution

- Reescrito System Prompt para forçar execução imediata de ferramentas
- Adicionados emojis de alerta (🚨) para destacar regras críticas
- Incluídos exemplos específicos de CORRETO vs. ERRADO
- Mapeamento de comandos comuns para tool calls diretas
- Ênfase em 'IMEDIATAMENTE' e 'AGORA' para evitar raciocínio excessivo

Closes: #MAX_ITERATIONS sem executar ferramentas
Refs: ANALISE-PROBLEMAS-TELEGRAM-14-04-2026.md
Refs: DIAGNOSTICO-ERROS-22-04-2026.md"

git commit -m $commitMsg

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit criado com sucesso" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao criar commit" -ForegroundColor Red
    exit 1
}

# 5. Git push
Write-Host ""
Write-Host "🌐 Enviando para GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push realizado com sucesso" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao fazer push" -ForegroundColor Red
    Write-Host "   Execute manualmente: git push origin main" -ForegroundColor Yellow
    exit 1
}

# 6. Deploy na VPS via SSH
Write-Host ""
Write-Host "🖥️  Fazendo deploy na VPS..." -ForegroundColor Yellow
Write-Host "   Host: root@147.93.69.211" -ForegroundColor Gray

$sshCommands = @"
cd /opt/gueclaw-agent && \
git pull origin main && \
pm2 restart gueclaw && \
echo '✅ Deploy concluído com sucesso!' && \
pm2 logs gueclaw --lines 20
"@

Write-Host ""
Write-Host "Executando SSH..." -ForegroundColor Yellow
ssh root@147.93.69.211 $sshCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ DEPLOY COMPLETO!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Teste agora no Telegram:" -ForegroundColor Cyan
    Write-Host "   'Liste os containers docker'" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 Monitorar logs:" -ForegroundColor Cyan
    Write-Host "   ssh root@147.93.69.211" -ForegroundColor White
    Write-Host "   pm2 logs gueclaw" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "⚠️  Falha ao conectar via SSH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Execute manualmente na VPS:" -ForegroundColor Cyan
    Write-Host "   ssh root@147.93.69.211" -ForegroundColor White
    Write-Host "   cd /opt/gueclaw-agent" -ForegroundColor White
    Write-Host "   git pull origin main" -ForegroundColor White
    Write-Host "   pm2 restart gueclaw" -ForegroundColor White
}

Write-Host ""
