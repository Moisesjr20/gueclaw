#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Configura todos os secrets necessários no GitHub Actions diretamente da VPS .env
.DESCRIPTION
    Script interativo que lê o .env local e configura os secrets no GitHub usando gh CLI
#>

param(
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

# Verifica se gh CLI está instalado
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) não está instalado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale com:" -ForegroundColor Yellow
    Write-Host "  winget install --id GitHub.cli" -ForegroundColor Cyan
    Write-Host "Ou baixe de: https://cli.github.com/" -ForegroundColor Cyan
    exit 1
}

# Verifica autenticação
$authStatus = gh auth status 2>&1 | Out-String
if ($authStatus -notmatch "Logged in to github.com account") {
    Write-Host "❌ Você não está autenticado no GitHub CLI!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Execute:" -ForegroundColor Yellow
    Write-Host "  gh auth login" -ForegroundColor Cyan
    exit 1
}

Write-Host "🔐 Configurador de Secrets do GitHub Actions" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Lê .env
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "❌ Arquivo .env não encontrado em: $envPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lendo $envPath..." -ForegroundColor Gray

$envVars = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
}

# Lê chave SSH
$sshKeyPath = "C:\Users\kyriu\.ssh\gueclaw_vps"
$sshKey = ""
if (Test-Path $sshKeyPath) {
    $sshKey = Get-Content $sshKeyPath -Raw
    Write-Host "✅ Chave SSH encontrada: $sshKeyPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  Chave SSH não encontrada em: $sshKeyPath" -ForegroundColor Yellow
}

# Secrets obrigatórios
$requiredSecrets = @{
    "VPS_SSH_PRIVATE_KEY" = $sshKey
    "TELEGRAM_BOT_TOKEN" = $envVars["TELEGRAM_BOT_TOKEN"]
    "TELEGRAM_ALLOWED_USER_IDS" = $envVars["TELEGRAM_ALLOWED_USER_IDS"]
    "TELEGRAM_USER_CHAT_ID" = $envVars["TELEGRAM_USER_CHAT_ID"]
    "DATABASE_ENCRYPTION_KEY" = $envVars["DATABASE_ENCRYPTION_KEY"]
    "DASHBOARD_API_KEY" = $envVars["DASHBOARD_API_KEY"]
}

# Secrets opcionais (adicione apenas se existirem)
$optionalSecrets = @{
    "UAIZAPI_TOKEN" = $envVars["UAIZAPI_TOKEN"]
    "DEEPSEEK_API_KEY" = $envVars["DEEPSEEK_API_KEY"]
    "GEMINI_API_KEY" = $envVars["GEMINI_API_KEY"]
    "GOOGLE_PERSONAL_CLIENT_ID" = $envVars["GOOGLE_PERSONAL_CLIENT_ID"]
    "GOOGLE_PERSONAL_CLIENT_SECRET" = $envVars["GOOGLE_PERSONAL_CLIENT_SECRET"]
    "GOOGLE_PERSONAL_REDIRECT_URI" = $envVars["GOOGLE_PERSONAL_REDIRECT_URI"]
    "GOOGLE_PERSONAL_REFRESH_TOKEN" = $envVars["GOOGLE_PERSONAL_REFRESH_TOKEN"]
    "GOOGLE_PERSONAL_CALENDAR_ID" = $envVars["GOOGLE_PERSONAL_CALENDAR_ID"]
    "GOOGLE_WORK_CLIENT_ID" = $envVars["GOOGLE_WORK_CLIENT_ID"]
    "GOOGLE_WORK_CLIENT_SECRET" = $envVars["GOOGLE_WORK_CLIENT_SECRET"]
    "GOOGLE_WORK_REDIRECT_URI" = $envVars["GOOGLE_WORK_REDIRECT_URI"]
    "GOOGLE_WORK_REFRESH_TOKEN" = $envVars["GOOGLE_WORK_REFRESH_TOKEN"]
    "GOOGLE_WORK_CALENDAR_ID" = $envVars["GOOGLE_WORK_CALENDAR_ID"]
    "OBSIDIAN_VAULT_REPO" = $envVars["OBSIDIAN_VAULT_REPO"]
    "OBSIDIAN_GITHUB_TOKEN" = $envVars["OBSIDIAN_GITHUB_TOKEN"]
    "GITHUB_CLASSIC" = $envVars["GITHUB_CLASSIC"]
    "N8N_API_URL" = $envVars["N8N_API_URL"]
    "N8N_API_KEY" = $envVars["N8N_API_KEY"]
}

Write-Host ""
Write-Host "📋 Secrets encontrados:" -ForegroundColor Cyan
Write-Host "  Obrigatórios: $($requiredSecrets.Count)/6" -ForegroundColor White
Write-Host "  Opcionais: $($optionalSecrets.Count)/18" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "🧪 DRY RUN MODE - Nenhum secret será configurado" -ForegroundColor Yellow
    Write-Host ""
}

# Configurar secrets obrigatórios
Write-Host "🔐 Configurando secrets obrigatórios..." -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $requiredSecrets.GetEnumerator()) {
    $name = $secret.Key
    $value = $secret.Value
    
    if (-not $value) {
        Write-Host "  ⚠️  $name - NÃO ENCONTRADO" -ForegroundColor Yellow
        continue
    }
    
    $preview = if ($value.Length -gt 40) { $value.Substring(0, 20) + "..." + $value.Substring($value.Length - 10) } else { $value }
    
    if ($DryRun) {
        Write-Host "  🔍 $name = $preview" -ForegroundColor Gray
    } else {
        try {
            $value | gh secret set $name 2>&1 | Out-Null
            Write-Host "  ✅ $name" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ $name - ERRO: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "📦 Configurando secrets opcionais..." -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $optionalSecrets.GetEnumerator()) {
    $name = $secret.Key
    $value = $secret.Value
    
    if (-not $value) {
        Write-Host "  ⏭️  $name - IGNORADO (não configurado no .env)" -ForegroundColor DarkGray
        continue
    }
    
    if ($DryRun) {
        $preview = if ($value.Length -gt 40) { $value.Substring(0, 15) + "..." } else { $value }
        Write-Host "  🔍 $name = $preview" -ForegroundColor Gray
    } else {
        try {
            $value | gh secret set $name 2>&1 | Out-Null
            Write-Host "  ✅ $name" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  $name - ERRO: $_" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
if ($DryRun) {
    Write-Host "🧪 Dry run completo! Execute sem -DryRun para aplicar" -ForegroundColor Yellow
} else {
    Write-Host "✅ Secrets configurados com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Faça merge da branch fix/github-actions-secrets na main" -ForegroundColor White
    Write-Host "  2. Ou faça um novo push para main para disparar o deploy" -ForegroundColor White
    Write-Host ""
    Write-Host "Verifique os workflows em:" -ForegroundColor Gray
    Write-Host "  https://github.com/Moisesjr20/gueclaw/actions" -ForegroundColor Blue
}
