# ============================================
# GueClaw - Sync GitHub Token to VPS
# ============================================
# Este script copia o github-token.json local para a VPS
# e reinicia o processo PM2 para aplicar o novo token.
# 
# Agendamento: Execute a cada 15 minutos via Task Scheduler
# ============================================

$ErrorActionPreference = "Stop"

# Carregar variáveis do .env
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envPath)) {
    Write-Error "Arquivo .env não encontrado em: $envPath"
    exit 1
}

# Parse .env
$env:VPS_HOST = ""
$env:VPS_PASSWORD = ""
$env:VPS_SSH_KEY_PATH = ""

Get-Content $envPath | ForEach-Object {
    if ($_ -match '^VPS_HOST=(.+)$') {
        $env:VPS_HOST = $matches[1]
    }
    if ($_ -match '^VPS_PASSWORD=(.+)$') {
        $env:VPS_PASSWORD = $matches[1]
    }
    if ($_ -match '^VPS_SSH_KEY_PATH=(.+)$') {
        $env:VPS_SSH_KEY_PATH = $matches[1]
    }
}

if (-not $env:VPS_HOST -or -not $env:VPS_PASSWORD) {
    Write-Error "VPS_HOST ou VPS_PASSWORD não encontrado no .env"
    exit 1
}

$localTokenPath = Join-Path $PSScriptRoot ".." "data" "github-token.json"
$vpsTokenPath = "/opt/gueclaw-agent/data/github-token.json"

Write-Host "🔄 Sincronizando GitHub Token para VPS..." -ForegroundColor Cyan

# Verificar se o arquivo local existe
if (-not (Test-Path $localTokenPath)) {
    Write-Warning "Token local não encontrado: $localTokenPath"
    Write-Warning "Execute a autenticação local primeiro."
    exit 0
}

# Verificar idade do token (só sincroniza se tiver menos de 20 minutos)
$tokenAge = (Get-Date) - (Get-Item $localTokenPath).LastWriteTime
if ($tokenAge.TotalMinutes -gt 20) {
    Write-Warning "Token local tem mais de 20 minutos. Pode estar expirado."
    Write-Host "Execute: npm run auth:copilot" -ForegroundColor Yellow
    exit 0
}

Write-Host "✓ Token local OK (idade: $([Math]::Round($tokenAge.TotalMinutes, 1)) min)" -ForegroundColor Green

# Verificar método de autenticação
$useSshKey = $false
if ($env:VPS_SSH_KEY_PATH -and (Test-Path $env:VPS_SSH_KEY_PATH)) {
    $useSshKey = $true
    Write-Host "🔑 Usando chave SSH: $env:VPS_SSH_KEY_PATH" -ForegroundColor Cyan
}

# Usar SSH key se disponível
if ($useSshKey) {
    # Copiar com scp usando chave
    scp -i "$env:VPS_SSH_KEY_PATH" -o "StrictHostKeyChecking=no" "$localTokenPath" "$env:VPS_HOST`:$vpsTokenPath"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao copiar token com scp + key"
        exit 1
    }
    
    Write-Host "✓ Token copiado para VPS" -ForegroundColor Green
    
    # Reiniciar processo PM2
    Write-Host "🔄 Reiniciando gueclaw-agent..." -ForegroundColor Cyan
    ssh -i "$env:VPS_SSH_KEY_PATH" -o "StrictHostKeyChecking=no" $env:VPS_HOST "cd /opt/gueclaw-agent && pm2 reload gueclaw-agent --update-env"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Sincronização concluída com sucesso!" -ForegroundColor Green
        Write-Host "Próxima execução em 15 minutos." -ForegroundColor Gray
    } else {
        Write-Warning "Token copiado, mas falha ao reiniciar PM2."
    }
    
    exit 0
}

# Fallback: Usar plink/pscp ou scp com senha
# Usar plink (PuTTY) para SCP com senha via variable
$plinkPath = "plink.exe"
$pscpPath = "pscp.exe"

# Verificar se plink/pscp estão instalados
if (-not (Get-Command $plinkPath -ErrorAction SilentlyContinue)) {
    Write-Warning "PuTTY (plink/pscp) não encontrado."
    Write-Host "Instale: choco install putty ou baixe de https://www.putty.org/" -ForegroundColor Yellow
    
    # Fallback: usar scp nativo (requer configuração de chave SSH)
    Write-Host "Tentando scp nativo (pode pedir senha)..." -ForegroundColor Yellow
    $scpCmd = "scp `"$localTokenPath`" $env:VPS_HOST`:$vpsTokenPath"
    Invoke-Expression $scpCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao copiar token com scp"
        exit 1
    }
} else {
    # Usar pscp com senha via environment
    $env:PSCP_PASSWORD = $env:VPS_PASSWORD
    & $pscpPath -pw $env:VPS_PASSWORD -batch "$localTokenPath" "$env:VPS_HOST`:$vpsTokenPath"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao copiar token com pscp"
        exit 1
    }
}

Write-Host "✓ Token copiado para VPS" -ForegroundColor Green

# Reiniciar processo PM2 (opcional - só se necessário)
Write-Host "🔄 Reiniciando gueclaw-agent..." -ForegroundColor Cyan

if (Get-Command $plinkPath -ErrorAction SilentlyContinue) {
    & $plinkPath -pw $env:VPS_PASSWORD -batch $env:VPS_HOST "cd /opt/gueclaw-agent && pm2 reload gueclaw-agent --update-env"
} else {
    ssh $env:VPS_HOST "cd /opt/gueclaw-agent && pm2 reload gueclaw-agent --update-env"
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Sincronização concluída com sucesso!" -ForegroundColor Green
    Write-Host "Próxima execução em 15 minutos." -ForegroundColor Gray
} else {
    Write-Warning "Token copiado, mas falha ao reiniciar PM2."
}
