#Requires -Version 5.1
<#
.SYNOPSIS
    Backup criptografado do banco de dados GueClaw (Windows)
.DESCRIPTION
    Cria backup do SQLite e criptografa usando AES-256
    Pode ser agendado via Task Scheduler para execução diária
#>

param(
    [string]$BackupDir = "$PSScriptRoot\..\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 GueClaw Database Backup - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Carregar .env
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "❌ Arquivo .env não encontrado" -ForegroundColor Red
    exit 1
}

$encryptionKey = $null
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^DATABASE_ENCRYPTION_KEY=(.+)$') {
        $encryptionKey = $matches[1].Trim()
    }
}

if (-not $encryptionKey) {
    Write-Host "❌ DATABASE_ENCRYPTION_KEY não encontrado no .env" -ForegroundColor Red
    exit 1
}

# Configuração
$dbPath = Join-Path $PSScriptRoot ".." "data" "gueclaw.db"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempBackup = Join-Path $env:TEMP "gueclaw_backup_$timestamp.db"
$encryptedBackup = Join-Path $BackupDir "gueclaw_$timestamp.db.aes"

# Criar diretório de backup
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "✅ Diretório de backup criado: $BackupDir" -ForegroundColor Green
}

# Verificar se o banco existe
if (-not (Test-Path $dbPath)) {
    Write-Host "❌ Banco de dados não encontrado: $dbPath" -ForegroundColor Red
    exit 1
}

# Criar backup (cópia simples)
Write-Host "📦 Criando backup de $dbPath..." -ForegroundColor Yellow
Copy-Item $dbPath $tempBackup -Force

$backupSize = (Get-Item $tempBackup).Length / 1MB
Write-Host "✅ Backup criado: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green

# Criptografar usando AES-256-GCM (via .NET)
Write-Host "🔐 Criptografando backup com AES-256-GCM..." -ForegroundColor Yellow

try {
    $backupBytes = [System.IO.File]::ReadAllBytes($tempBackup)
    $keyBytes = [System.Convert]::FromHexString($encryptionKey)
    
    # AES-256-GCM
    $aes = [System.Security.Cryptography.AesGcm]::new($keyBytes)
    $nonce = New-Object byte[] 12
    $tag = New-Object byte[] 16
    $ciphertext = New-Object byte[] $backupBytes.Length
    
    # Gerar nonce aleatório
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($nonce)
    
    # Criptografar
    $aes.Encrypt($nonce, $backupBytes, $ciphertext, $tag)
    
    # Salvar: Nonce (12) + Tag (16) + Ciphertext
    $encryptedData = $nonce + $tag + $ciphertext
    [System.IO.File]::WriteAllBytes($encryptedBackup, $encryptedData)
    
    $encryptedSize = (Get-Item $encryptedBackup).Length / 1MB
    Write-Host "✅ Backup criptografado: $([math]::Round($encryptedSize, 2)) MB → $encryptedBackup" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erro ao criptografar: $_" -ForegroundColor Red
    Remove-Item $tempBackup -Force -ErrorAction SilentlyContinue
    exit 1
}

# Remover backup temporário não criptografado
Remove-Item $tempBackup -Force

# Limpar backups antigos
Write-Host "🧹 Limpando backups antigos (retenção: $RetentionDays dias)..." -ForegroundColor Yellow
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupDir -Filter "gueclaw_*.db.aes" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Remove-Item $_.FullName -Force
}

$remainingBackups = (Get-ChildItem $BackupDir -Filter "gueclaw_*.db.aes").Count
Write-Host "✅ Backups retidos: $remainingBackups" -ForegroundColor Green

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Backup concluído com sucesso!" -ForegroundColor Green
Write-Host ""

# Listar últimos 5 backups
Write-Host "📋 Backups recentes:" -ForegroundColor Cyan
Get-ChildItem $BackupDir -Filter "gueclaw_*.db.aes" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "   $($_.Name) ($size MB) - $($_.LastWriteTime)" -ForegroundColor Gray
}
Write-Host ""
