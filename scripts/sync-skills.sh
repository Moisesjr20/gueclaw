#!/usr/bin/env bash
# sync-skills.sh — Sincroniza skills entre .agents/skills e meu-vault-obsidian
# Uso:  bash scripts/sync-skills.sh pull   → vault → local
#       bash scripts/sync-skills.sh push   → local → vault
#       bash scripts/sync-skills.sh status → ver diferenças

set -e

VAULT_REPO="https://github.com/Moisesjr20/meu-vault-obsidian.git"
VAULT_SKILLS="GueClaw/skills/myskills"
VAULT_AGENTS="GueClaw/skills/myagents"
LOCAL_SKILLS=".agents/skills"
LOCAL_AGENTS=".agents/agents"
TMP_DIR="/tmp/gueclaw-vault-sync-$$"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DIRECTION="${1:-status}"
COMMIT_MSG="${2:-feat: sync skills from gueclaw $(date '+%Y-%m-%d %H:%M')}"

step()  { echo -e "\n\033[36m→ $1\033[0m"; }
ok()    { echo -e "  \033[32m✓ $1\033[0m"; }
warn()  { echo -e "  \033[33m⚠ $1\033[0m"; }

# ── PULL: vault → local ───────────────────────────────────────────────────────
if [[ "$DIRECTION" == "pull" ]]; then
    step "Clonando meu-vault-obsidian (shallow)..."
    git clone --depth 1 "$VAULT_REPO" "$TMP_DIR" 2>/dev/null
    ok "Clone ok"

    step "Copiando skills do vault para $LOCAL_SKILLS..."
    if [[ -d "$TMP_DIR/$VAULT_SKILLS" ]]; then
        rsync -a --delete "$TMP_DIR/$VAULT_SKILLS/" "$LOCAL_SKILLS/"
        ok "Skills sincronizadas"
    else
        warn "Pasta $VAULT_SKILLS não encontrada no vault"
    fi

    step "Copiando agents do vault para $LOCAL_AGENTS..."
    if [[ -d "$TMP_DIR/$VAULT_AGENTS" ]]; then
        mkdir -p "$LOCAL_AGENTS"
        rsync -a --delete "$TMP_DIR/$VAULT_AGENTS/" "$LOCAL_AGENTS/"
        ok "Agents sincronizados"
    else
        warn "Pasta $VAULT_AGENTS não encontrada no vault"
    fi

    rm -rf "$TMP_DIR"
    ok "Sync pull concluído! Verifique com: git diff .agents/"

# ── PUSH: local → vault ───────────────────────────────────────────────────────
elif [[ "$DIRECTION" == "push" ]]; then
    step "Clonando meu-vault-obsidian para edição..."
    git clone --depth 1 "$VAULT_REPO" "$TMP_DIR" 2>/dev/null
    ok "Clone ok"

    step "Copiando $LOCAL_SKILLS para vault/$VAULT_SKILLS..."
    mkdir -p "$TMP_DIR/$VAULT_SKILLS"
    rsync -a --delete "$LOCAL_SKILLS/" "$TMP_DIR/$VAULT_SKILLS/"
    ok "Skills copiadas"

    step "Commitando e enviando para o vault..."
    cd "$TMP_DIR"
    git add "$VAULT_SKILLS"
    CHANGED=$(git diff --cached --name-only | wc -l)
    if [[ "$CHANGED" -gt 0 ]]; then
        git commit -m "$COMMIT_MSG"
        git push origin main
        ok "Push para meu-vault-obsidian concluído!"
    else
        warn "Sem mudanças para enviar ao vault"
    fi
    cd "$ROOT"
    rm -rf "$TMP_DIR"

# ── STATUS: mostrar diferenças ────────────────────────────────────────────────
elif [[ "$DIRECTION" == "status" ]]; then
    step "Clonando meu-vault-obsidian para comparação..."
    git clone --depth 1 "$VAULT_REPO" "$TMP_DIR" 2>/dev/null

    echo -e "\n\033[33m=== Skills no vault mas não localmente ===\033[0m"
    for d in "$TMP_DIR/$VAULT_SKILLS"/*/; do
        name=$(basename "$d")
        [[ ! -d "$LOCAL_SKILLS/$name" ]] && echo "  + (vault somente) $name"
    done

    echo -e "\n\033[33m=== Skills locais mas não no vault ===\033[0m"
    for d in "$LOCAL_SKILLS"/*/; do
        name=$(basename "$d")
        [[ ! -d "$TMP_DIR/$VAULT_SKILLS/$name" ]] && echo "  + (local somente) $name"
    done

    rm -rf "$TMP_DIR"
else
    echo "Uso: $0 [pull|push|status] [mensagem-commit]"
    exit 1
fi
