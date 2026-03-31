# ============================================
# GueClaw - Configure SSH Key Authentication
# ============================================
# Configura autenticação por chave SSH para VPS
# Elimina necessidade de senha interativa.
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "🔐 Configurando SSH Key Authentication" -ForegroundColor Cyan
Write-Host ""

# Carregar VPS_HOST do .env
$envPath = Join-Path $PSScriptRoot ".." ".env"
$vpsHost = (Get-Content $envPath | Where-Object { $_ -match '^VPS_HOST=(.+)$' } | ForEach-Object { $matches[1] })

if (-not $vpsHost) {
    Write-Error "VPS_HOST não encontrado no .env"
    exit 1
}

$keyPath = Join-Path $env:USERPROFILE ".ssh" "gueclaw_vps"

# Verificar se a chave já existe
if (Test-Path "$keyPath") {
    Write-Host "✓ Chave SSH já existe: $keyPath" -ForegroundColor Green
    $response = Read-Host "Deseja recriar? (s/N)"
    
    if ($response -ne 's' -and $response -ne 'S') {
        Write-Host "Usando chave existente." -ForegroundColor Yellow
        $recreate = $false
    } else {
        $recreate = $true
    }
} else {
    $recreate = $true
}

# Criar diretório .ssh se não existir
$sshDir = Split-Path $keyPath -Parent
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

# Gerar nova chave
if ($recreate) {
    Write-Host "🔑 Gerando par de chaves SSH (ed25519)..." -ForegroundColor Cyan
    
    # Remover chave antiga se existir
    if (Test-Path "$keyPath") {
        Remove-Item "$keyPath" -Force
        Remove-Item "$keyPath.pub" -Force -ErrorAction SilentlyContinue
    }
    
    # Gerar nova chave sem senha (para automação)
    ssh-keygen -t ed25519 -f "$keyPath" -N '""' -C "gueclaw-sync@$(hostname)"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao gerar chave SSH"
        exit 1
    }
    
    Write-Host "✓ Chave gerada: $keyPath" -ForegroundColor Green
}

# Ler chave pública
$pubKey = Get-Content "$keyPath.pub" -Raw

Write-Host ""
Write-Host "📤 Copiando chave pública para VPS..." -ForegroundColor Cyan
Write-Host "⚠️  Você precisará digitar a senha do VPS uma última vez." -ForegroundColor Yellow
Write-Host ""

# Copiar chave para VPS
$sshCopyIdCommand = @"
mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'SSH key instalada com sucesso!'
"@

ssh $vpsHost $sshCopyIdCommand

if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao copiar chave para VPS"
    exit 1
}

Write-Host "✅ Chave pública copiada para VPS!" -ForegroundColor Green
Write-Host ""

# Testar conexão
Write-Host "🧪 Testando conexão SSH sem senha..." -ForegroundColor Cyan
ssh -i "$keyPath" -o "StrictHostKeyChecking=no" $vpsHost "echo 'Conexão OK!'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Autenticação por chave funcionando!" -ForegroundColor Green
    Write-Host ""
    
    # Atualizar .env com o caminho da chave
    Write-Host "📝 Atualizando .env..." -ForegroundColor Cyan
    $envContent = Get-Content $envPath -Raw
    
    if ($envContent -match 'VPS_SSH_KEY_PATH=') {
        $envContent = $envContent -replace 'VPS_SSH_KEY_PATH=.*', "VPS_SSH_KEY_PATH=$keyPath"
    } else {
        $envContent += "`nVPS_SSH_KEY_PATH=$keyPath`n"
    }
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "✓ VPS_SSH_KEY_PATH configurado no .env" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✨ Configuração concluída!" -ForegroundColor Green
    Write-Host "Agora você pode executar comandos SSH sem senha." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Exemplo: ssh -i `"$keyPath`" $vpsHost" -ForegroundColor DarkGray
} else {
    Write-Warning "Teste de conexão falhou. Verifique as permissões no VPS."
}
