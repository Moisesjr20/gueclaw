# 🔒 Instalador de Security Audit - Execução via SSH do Windows
# Copia o script para a VPS e instala o cron job

param(
    [switch]$TestNow = $false
)

$ErrorActionPreference = "Stop"

# Configurações
$VPS_HOST = "147.93.69.211"
$VPS_USER = "root"
$SSH_KEY = "$env:USERPROFILE\.ssh\gueclaw_vps"

Write-Host "🔒 GueClaw Security Audit - Instalador" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se a chave SSH existe
if (!(Test-Path $SSH_KEY)) {
    Write-Host "❌ Chave SSH não encontrada: $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Copiando scripts para VPS..." -ForegroundColor Yellow

# Copia o script Python de auditoria
$pythonScript = "scripts\security-audit-vps.py"
if (Test-Path $pythonScript) {
    scp -i $SSH_KEY $pythonScript "${VPS_USER}@${VPS_HOST}:/opt/gueclaw-agent/scripts/"
    Write-Host "   ✅ security-audit-vps.py copiado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Arquivo não encontrado: $pythonScript" -ForegroundColor Red
    exit 1
}

# Copia o instalador do cron
$cronInstaller = "scripts\install-security-audit-cron.sh"
if (Test-Path $cronInstaller) {
    scp -i $SSH_KEY $cronInstaller "${VPS_USER}@${VPS_HOST}:/opt/gueclaw-agent/scripts/"
    Write-Host "   ✅ install-security-audit-cron.sh copiado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Arquivo não encontrado: $cronInstaller" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Instalando cron job na VPS..." -ForegroundColor Yellow

# Executa o instalador na VPS
ssh -i $SSH_KEY "${VPS_USER}@${VPS_HOST}" "bash /opt/gueclaw-agent/scripts/install-security-audit-cron.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Cron job instalado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📅 Varredura de segurança agendada para:" -ForegroundColor Cyan
    Write-Host "   • Horário: 6h da manhã (todos os dias)" -ForegroundColor White
    Write-Host "   • Relatório enviado via Telegram" -ForegroundColor White
    Write-Host ""
    
    if ($TestNow) {
        Write-Host "🧪 Executando teste agora..." -ForegroundColor Yellow
        Write-Host ""
        
        ssh -i $SSH_KEY "${VPS_USER}@${VPS_HOST}" "cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Teste executado com sucesso! Verifique o Telegram." -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️ Teste falhou. Verifique os logs na VPS." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Para testar agora, execute:" -ForegroundColor Cyan
        Write-Host "   .\scripts\install-security-audit.ps1 -TestNow" -ForegroundColor White
        Write-Host ""
        Write-Host "Ou manualmente na VPS:" -ForegroundColor Cyan
        Write-Host "   ssh root@$VPS_HOST" -ForegroundColor White
        Write-Host "   cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "📊 Para ver os logs de execuções passadas:" -ForegroundColor Cyan
    Write-Host "   ssh root@$VPS_HOST 'tail -100 /var/log/gueclaw-security-audit.log'" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ Erro ao instalar cron job" -ForegroundColor Red
    exit 1
}
