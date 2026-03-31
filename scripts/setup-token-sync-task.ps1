# ============================================
# GueClaw - Setup Token Sync Task Scheduler
# ============================================
# Cria uma tarefa agendada do Windows para sincronizar
# o GitHub token para VPS a cada 15 minutos.
# 
# Execute como Administrador!
# ============================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$taskName = "GueClaw-SyncGitHubToken"
$scriptPath = Join-Path $PSScriptRoot "sync-github-token.ps1"
$logPath = Join-Path $PSScriptRoot ".." "logs" "token-sync.log"

Write-Host "⚙️  Configurando tarefa agendada: $taskName" -ForegroundColor Cyan

# Verificar se o script existe
if (-not (Test-Path $scriptPath)) {
    Write-Error "Script não encontrado: $scriptPath"
    exit 1
}

# Verificar se a tarefa já existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Warning "Tarefa '$taskName' já existe!"
    $response = Read-Host "Deseja recriar? (s/N)"
    
    if ($response -ne 's' -and $response -ne 'S') {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "🗑️  Removendo tarefa existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Criar diretório de logs se não existir
$logsDir = Split-Path $logPath -Parent
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Criar ação (executa o script)
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" >> `"$logPath`" 2>&1"

# Criar trigger (a cada 15 minutos, indefinidamente)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

# Configurações adicionais
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Principal (usuário atual)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

# Registrar tarefa
Write-Host "📝 Registrando tarefa..." -ForegroundColor Cyan

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Sincroniza github-token.json local para VPS GueClaw a cada 15 minutos (workaround para bloqueio Hostinger)"

Write-Host "✅ Tarefa criada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Detalhes:" -ForegroundColor White
Write-Host "  Nome: $taskName" -ForegroundColor Gray
Write-Host "  Intervalo: A cada 15 minutos" -ForegroundColor Gray
Write-Host "  Script: $scriptPath" -ForegroundColor Gray
Write-Host "  Log: $logPath" -ForegroundColor Gray
Write-Host ""
Write-Host "🔍 Comandos úteis:" -ForegroundColor White
Write-Host "  Ver status: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Executar agora: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Ver histórico: Get-ScheduledTaskInfo -TaskName '$taskName'" -ForegroundColor Gray
Write-Host "  Ver logs: Get-Content '$logPath' -Tail 50" -ForegroundColor Gray
Write-Host "  Remover: Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host ""

# Oferecer executar agora
$runNow = Read-Host "Deseja executar a tarefa agora para testar? (S/n)"

if ($runNow -eq '' -or $runNow -eq 's' -or $runNow -eq 'S') {
    Write-Host "▶️  Executando tarefa..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    
    Write-Host ""
    Write-Host "📄 Últimas linhas do log:" -ForegroundColor White
    if (Test-Path $logPath) {
        Get-Content $logPath -Tail 20 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    } else {
        Write-Host "  (log ainda não gerado)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "✨ Pronto! O token será sincronizado automaticamente a cada 15 minutos." -ForegroundColor Green
