#!/bin/bash
# =============================================================
# deploy.sh - Script de deploy automático na VPS Linux
# Uso: ./deploy.sh
# =============================================================

set -e  # Para imediatamente em caso de erro

echo ""
echo "================================================="
echo "   GueClaw Bot - Deploy na VPS"
echo "================================================="
echo ""

# 1. Atualiza o código
echo "[1/5] Atualizando código do repositório..."
git pull origin main

# 2. Instala/atualiza dependências
echo "[2/5] Instalando dependências NPM..."
npm install --production=false

# 3. Compila TypeScript
echo "[3/5] Compilando TypeScript..."
npm run build

# 4. Cria diretórios necessários
echo "[4/5] Garantindo diretórios (data/, tmp/)..."
mkdir -p data tmp

# 5. Reinicia com PM2
echo "[5/5] Reiniciando serviço PM2..."
if pm2 describe gueclaw > /dev/null 2>&1; then
    pm2 restart gueclaw
else
    pm2 start dist/index.js --name "gueclaw" --watch=false
    pm2 save
fi

echo ""
echo "[OK] Deploy concluído!"
pm2 status gueclaw
