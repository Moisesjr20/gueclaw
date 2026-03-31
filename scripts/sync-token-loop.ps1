# ============================================
# GueClaw - Token Sync Loop (Background)
# ============================================
# Alternativa ao Task Scheduler - roda em loop
# sincronizando o token a cada 15 minutos.
# 
# NÃO requer privilégios de administrador!
# ============================================

$ErrorActionPreference = "Continue"

# Detectar diretório do script (compatível com jobs)
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) {
    $scriptDir = "d:\Clientes de BI\projeto GueguelClaw\scripts"
}

$syncScript = Join-Path $scriptDir "sync-github-token.ps1"
$interval = 15 # minutos

Write-Host "🔄 GueClaw Token Sync Loop" -ForegroundColor Cyan
Write-Host "Sincronizando a cada $interval minutos..." -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para parar.`n" -ForegroundColor Yellow

$iteration = 0

while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    Write-Host "[$timestamp] Execução #$iteration" -ForegroundColor White
    
    try {
        # Executar script de sync
        & $syncScript
        Write-Host "✅ Sync concluído" -ForegroundColor Green
    } catch {
        Write-Warning "Erro no sync: $_"
    }
    
    $nextRun = (Get-Date).AddMinutes($interval).ToString("HH:mm:ss")
    Write-Host "⏰ Próxima execução: $nextRun`n" -ForegroundColor Gray
    
    # Aguardar 15 minutos
    Start-Sleep -Seconds ($interval * 60)
}
