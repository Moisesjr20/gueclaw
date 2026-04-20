#!/bin/bash
# Script para atualizar a API key na VPS após vazamento de segurança
# Data: 2026-04-20

NEW_API_KEY="gc_dash_64102541_3451b5f679bb490d"
VPS_HOST="147.93.69.211"
ENV_FILE="/root/gueclaw/.env"

echo "🔐 Atualizando DASHBOARD_API_KEY na VPS..."

# Conectar via SSH e atualizar o .env
ssh root@$VPS_HOST << EOF
  cd /root/gueclaw
  
  # Backup do .env atual
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  
  # Atualizar ou adicionar a chave
  if grep -q "DASHBOARD_API_KEY=" .env; then
    sed -i "s/DASHBOARD_API_KEY=.*/DASHBOARD_API_KEY=$NEW_API_KEY/" .env
    echo "✅ DASHBOARD_API_KEY atualizada"
  else
    echo "DASHBOARD_API_KEY=$NEW_API_KEY" >> .env
    echo "✅ DASHBOARD_API_KEY adicionada"
  fi
  
  # Reiniciar o serviço (se estiver usando PM2)
  pm2 restart gueclaw 2>/dev/null || echo "⚠️  PM2 não encontrado ou serviço não está rodando"
  
  echo ""
  echo "📋 Verificando configuração:"
  grep "DASHBOARD_API_KEY" .env
EOF

echo ""
echo "✅ Atualização concluída na VPS"
echo "🔄 Aguarde alguns segundos para o serviço reiniciar"
