#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Sincroniza skills entre .agents/skills (local) e meu-vault-obsidian (GitHub).

.DESCRIPTION
  PULL:  Traz as skills mais recentes do vault para o projeto gueclaw
  PUSH:  Envia skills locais novas/modificadas para o vault

.EXAMPLE
  .\scripts\sync-skills.ps1 pull      # Baixar skills do vault
  .\scripts\sync-skills.ps1 push      # Enviar skills para o vault
  .\scripts\sync-skills.ps1 status    # Ver diferenças sem alterar nada
#>

param(
    [Parameter(Mandatory=$true)][ValidateSet("pull","push","status")][string]$Direction,
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Continue"

$VAULT_REPO   = "https://github.com/Moisesjr20/meu-vault-obsidian.git"
$VAULT_SKILLS = "GueClaw/skills/myskills"
$VAULT_AGENTS = "GueClaw/skills/myagents"
$LOCAL_SKILLS = ".agents/skills"
$LOCAL_AGENTS = ".agents/agents"
$TMP_DIR      = Join-Path $env:TEMP "gueclaw-vault-sync-$(Get-Random)"

$ROOT = Split-Path -Parent $PSScriptRoot

function Write-Step { param($msg) Write-Host "`n-> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  AVISO $msg" -ForegroundColor Yellow }

# ── PULL: vault → local ───────────────────────────────────────────────────────
if ($Direction -eq "pull") {
    Write-Step "Clonando meu-vault-obsidian (shallow)..."
    $null = git clone --depth 1 $VAULT_REPO $TMP_DIR 2>&1
    Write-Ok "Clone ok"

    Write-Step "Copiando skills do vault para .agents/skills..."
    $src = Join-Path $TMP_DIR $VAULT_SKILLS
    $dst = Join-Path $ROOT $LOCAL_SKILLS

    if (Test-Path $src) {
        # Copia apenas os conteúdos (mantém arquivos não presentes no vault)
        $items = Get-ChildItem $src
        foreach ($item in $items) {
            $target = Join-Path $dst $item.Name
            Copy-Item -Recurse -Force $item.FullName $target
            Write-Ok "Sincronizado: $($item.Name)"
        }
    } else {
        Write-Warn "Pasta $VAULT_SKILLS não encontrada no vault"
    }

    Write-Step "Copiando agents do vault para .agents/agents..."
    $srcA = Join-Path $TMP_DIR $VAULT_AGENTS
    $dstA = Join-Path $ROOT $LOCAL_AGENTS

    if (Test-Path $srcA) {
        New-Item -ItemType Directory -Force $dstA | Out-Null
        Copy-Item -Recurse -Force "$srcA\*" $dstA
        Write-Ok "Agents sincronizados"
    } else {
        Write-Warn "Pasta $VAULT_AGENTS não encontrada no vault"
    }

    Remove-Item -Recurse -Force $TMP_DIR
    Write-Ok "Sync pull concluído! Verifique com: git diff .agents/"
}

# ── PUSH: local → vault ───────────────────────────────────────────────────────
elseif ($Direction -eq "push") {
    $msg = if ($CommitMessage) { $CommitMessage } else { "feat: sync skills from gueclaw $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

    Write-Step "Clonando meu-vault-obsidian para edição..."
    $null = git clone --depth 1 $VAULT_REPO $TMP_DIR 2>&1
    Write-Ok "Clone ok"

    Write-Step "Copiando .agents/skills para vault/GueClaw/skills/myskills..."
    $src = Join-Path $ROOT $LOCAL_SKILLS
    $dst = Join-Path $TMP_DIR $VAULT_SKILLS

    New-Item -ItemType Directory -Force $dst | Out-Null
    Get-ChildItem $src | Where-Object { $_.Name -ne ".gitkeep" } | ForEach-Object {
        Copy-Item -Recurse -Force $_.FullName (Join-Path $dst $_.Name)
        Write-Ok "Enviado: $($_.Name)"
    }

    Write-Step "Commitando e enviando para o vault..."
    Push-Location $TMP_DIR
    git add "$VAULT_SKILLS" 2>&1 | Out-Null
    $changed = (git diff --cached --name-only 2>&1 | Measure-Object -Line).Lines
    if ($changed -gt 0) {
        git commit -m $msg 2>&1 | Out-Null
        git push origin main 2>&1
        Write-Ok "Push para meu-vault-obsidian concluído!"
    } else {
        Write-Warn "Sem mudanças para enviar ao vault"
    }
    Pop-Location
    Remove-Item -Recurse -Force $TMP_DIR
}

# ── STATUS: mostrar diferenças ────────────────────────────────────────────────
elseif ($Direction -eq "status") {
    Write-Step "Clonando meu-vault-obsidian para comparação..."
    $null = git clone --depth 1 $VAULT_REPO $TMP_DIR 2>&1

    $src = Join-Path $TMP_DIR $VAULT_SKILLS
    $dst = Join-Path $ROOT $LOCAL_SKILLS

    Write-Host "`n=== Skills no vault mas não localmente ===" -ForegroundColor Yellow
    Get-ChildItem $src | Where-Object {
        -not (Test-Path (Join-Path $dst $_.Name))
    } | ForEach-Object { Write-Host "  + (vault somente) $($_.Name)" -ForegroundColor Green }

    Write-Host "`n=== Skills locais mas não no vault ===" -ForegroundColor Yellow
    Get-ChildItem $dst | Where-Object {
        -not (Test-Path (Join-Path $src $_.Name))
    } | ForEach-Object { Write-Host "  + (local somente) $($_.Name)" -ForegroundColor Blue }

    Remove-Item -Recurse -Force $TMP_DIR
}
