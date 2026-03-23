#!/bin/bash
# =============================================================
# Setup: Obsidian Vault na VPS
# Clona o vault e configura git para o agente GueClaw
# Uso: bash setup-obsidian-vault.sh <GITHUB_PAT>
# =============================================================

set -e

GITHUB_TOKEN="${1:-$OBSIDIAN_GITHUB_TOKEN}"
VAULT_PATH="/opt/obsidian-vault"
REPO="Moisesjr20/meu-vault-obsidian"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Erro: forneça o GitHub PAT como argumento ou variável OBSIDIAN_GITHUB_TOKEN"
  echo "   Uso: bash setup-obsidian-vault.sh ghp_seu_token_aqui"
  exit 1
fi

echo "🔍 Verificando se vault já existe..."
if [ -d "$VAULT_PATH/.git" ]; then
  echo "✅ Vault já existe em $VAULT_PATH — fazendo pull..."
  cd "$VAULT_PATH"
  git pull origin main 2>/dev/null || git pull origin master
  echo "✅ Vault atualizado."
  exit 0
fi

echo "📦 Clonando vault do GitHub..."
git clone "https://${GITHUB_TOKEN}@github.com/${REPO}.git" "$VAULT_PATH"

echo "⚙️  Configurando identidade git..."
cd "$VAULT_PATH"
git config user.email "gueclaw-agent@kyrius.info"
git config user.name "GueClaw Agent"

# Salvar credenciais para pulls/pushes futuros sem reautenticar
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO}.git"

echo ""
echo "✅ Vault Obsidian configurado com sucesso!"
echo "   Localização: $VAULT_PATH"
echo "   Repositório: https://github.com/${REPO}"
echo ""
echo "📋 Notas encontradas:"
find "$VAULT_PATH" -name "*.md" | head -20 | sed "s|$VAULT_PATH/||"
