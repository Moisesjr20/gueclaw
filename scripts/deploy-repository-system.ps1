# ===================================================================
# Deploy: Sistema de Repositório de Arquivos
# Atualiza .env e skills na VPS via PowerShell
# ===================================================================

Write-Host "🚀 Iniciando deploy do sistema de repositório..." -ForegroundColor Cyan
Write-Host ""

# Configurações
$SSH_KEY = "C:\Users\kyriu\.ssh\gueclaw_vps"
$VPS_HOST = "root@147.93.69.211"
$VPS_PORT = "22"

# Função para executar comando SSH
function Invoke-SSHCommand {
    param (
        [string]$Command
    )
    ssh -i $SSH_KEY -p $VPS_PORT $VPS_HOST $Command
}

# Passo 1: Atualizar .env
Write-Host "📝 Passo 1: Atualizando .env na VPS..." -ForegroundColor Yellow

$checkEnv = Invoke-SSHCommand "grep -q 'FILES_REPOSITORY_PATH' /opt/gueclaw-agent/.env && echo 'exists' || echo 'missing'"

if ($checkEnv -match "exists") {
    Write-Host "   ℹ️  FILES_REPOSITORY_PATH já existe no .env" -ForegroundColor Gray
} else {
    Write-Host "   ➕ Adicionando FILES_REPOSITORY_PATH ao .env" -ForegroundColor Green
    Invoke-SSHCommand "echo '' >> /opt/gueclaw-agent/.env"
    Invoke-SSHCommand "echo '# ===== File Repository =====' >> /opt/gueclaw-agent/.env"
    Invoke-SSHCommand "echo '# Directory where user-accessible files are stored (HTML, JSON, CSV, etc)' >> /opt/gueclaw-agent/.env"
    Invoke-SSHCommand "echo 'FILES_REPOSITORY_PATH=/opt/gueclaw-data/files' >> /opt/gueclaw-agent/.env"
    Write-Host "   ✅ FILES_REPOSITORY_PATH adicionado" -ForegroundColor Green
}

Write-Host ""

# Passo 2: Git pull
Write-Host "📦 Passo 2: Fazendo git pull das skills atualizadas..." -ForegroundColor Yellow
Invoke-SSHCommand "cd /opt/gueclaw-agent && git pull origin main"
Write-Host "   ✅ Skills atualizadas" -ForegroundColor Green

Write-Host ""

# Passo 3: Build
Write-Host "🔨 Passo 3: Rebuild do projeto..." -ForegroundColor Yellow
Invoke-SSHCommand "cd /opt/gueclaw-agent && npm run build"
Write-Host "   ✅ Build concluído" -ForegroundColor Green

Write-Host ""

# Passo 4: Reiniciar PM2
Write-Host "🔄 Passo 4: Reiniciando PM2..." -ForegroundColor Yellow
Invoke-SSHCommand "pm2 restart gueclaw-agent"
Write-Host "   ✅ PM2 reiniciado" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host ""

# Verificação
Write-Host "📊 Verificando configuração..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Variáveis de ambiente:" -ForegroundColor White
Invoke-SSHCommand "grep -E 'MAX_ITERATIONS|FILES_REPOSITORY' /opt/gueclaw-agent/.env"

Write-Host ""
Write-Host "Status PM2:" -ForegroundColor White
Invoke-SSHCommand "pm2 list"

Write-Host ""
Write-Host "🧪 Teste agora via Telegram:" -ForegroundColor Cyan
Write-Host "   'lista todos os arquivos do repositório'" -ForegroundColor White
Write-Host ""
