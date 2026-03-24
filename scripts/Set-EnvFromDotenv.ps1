#Requires -Version 5.1
<#
.SYNOPSIS
    Importa todas as variaveis do .env do GueClaw como variaveis de ambiente do sistema (User scope).
    Apos executar, feche e reabra o VS Code para que ${env:VAR} no mcp.json seja resolvido corretamente.

.USAGE
    .\scripts\Set-EnvFromDotenv.ps1
    .\scripts\Set-EnvFromDotenv.ps1 -DotEnvPath "C:\caminho\customizado\.env"
    .\scripts\Set-EnvFromDotenv.ps1 -Scope Machine   # requer admin, persiste para todos os usuarios
    .\scripts\Set-EnvFromDotenv.ps1 -DryRun           # apenas mostra o que seria configurado
#>

param(
    [string]$DotEnvPath = (Join-Path (Split-Path $PSScriptRoot -Parent) ".env"),
    [ValidateSet("User","Machine")]
    [string]$Scope = "User",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Validacoes ---------------------------------------------------------------
$resolvedPath = Resolve-Path $DotEnvPath -ErrorAction SilentlyContinue
if (-not $resolvedPath) {
    Write-Error "ERRO: Arquivo .env nao encontrado em: $DotEnvPath"
    exit 1
}
if ($Scope -eq "Machine" -and -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "ERRO: Scope 'Machine' requer privilegios de Administrador. Rode como Admin ou use -Scope User."
    exit 1
}

# -- Leitura do .env ----------------------------------------------------------
$lines     = Get-Content $resolvedPath -Encoding UTF8
$imported  = 0
$skipped   = 0
$sensitive = @("TOKEN","KEY","SECRET","PASSWORD","REFRESH","PAT","CLASSIC")

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  GueClaw -- Importar .env -> Variaveis de Sistema" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Arquivo : $resolvedPath" -ForegroundColor Gray
Write-Host "  Escopo  : $Scope" -ForegroundColor Gray
if ($DryRun) { Write-Host "  Modo    : DRY-RUN (nenhuma alteracao sera feita)" -ForegroundColor Yellow }
Write-Host ""

foreach ($line in $lines) {
    $line = $line.Trim()

    # Ignorar comentarios e linhas vazias
    if ($line -eq "" -or $line.StartsWith("#")) { continue }

    # Parser: chave=valor (valor pode conter =)
    $eqIdx = $line.IndexOf("=")
    if ($eqIdx -lt 1) { $skipped++; continue }

    $key   = $line.Substring(0, $eqIdx).Trim()
    $value = $line.Substring($eqIdx + 1).Trim()

    # Ignorar valores placeholder
    if ($value -match "^your_|^<|^\s*$") { $skipped++; continue }

    # Mascarar valores sensiveis no output
    $isSensitive = $sensitive | Where-Object { $key -match $_ }
    $display     = if ($isSensitive) { "$($value.Substring(0, [Math]::Min(8, $value.Length)))..." } else { $value }

    if ($DryRun) {
        Write-Host "  [DRY] $key = $display" -ForegroundColor DarkYellow
    } else {
        [System.Environment]::SetEnvironmentVariable($key, $value, $Scope)
        # Tambem define na sessao atual para uso imediato
        Set-Item -Path "Env:\$key" -Value $value
        Write-Host "  OK  $key = $display" -ForegroundColor Green
    }
    $imported++
}

# -- Resumo -------------------------------------------------------------------
Write-Host ""
Write-Host "------------------------------------------------------------"
if ($DryRun) {
    Write-Host "  [DRY-RUN] $imported variaveis seriam importadas, $skipped ignoradas." -ForegroundColor Yellow
} else {
    Write-Host "  DONE: $imported variaveis importadas no escopo '$Scope'." -ForegroundColor Green
    Write-Host "  SKIP: $skipped linhas ignoradas (comentarios/placeholders)." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  IMPORTANTE: feche e reabra o VS Code para que" -ForegroundColor Yellow
    Write-Host "  o MCP server resolva `${env:N8N_API_URL}` corretamente." -ForegroundColor Yellow
}
Write-Host ""

