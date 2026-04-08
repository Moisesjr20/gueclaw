#!/bin/bash
# ===================================================================
# Deploy: Sistema de Repositório de Arquivos
# Atualiza .env e skills na VPS
# ===================================================================

set -e  # Exit on error

echo "🚀 Iniciando deploy do sistema de repositório..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f ".env" ]; then
    echo "❌ Erro: Execute este script da raiz do projeto GueClaw"
    exit 1
fi

echo "📝 Passo 1: Atualizando .env na VPS..."
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211 << 'EOF'
    # Verificar se FILES_REPOSITORY_PATH já existe
    if grep -q "FILES_REPOSITORY_PATH" /opt/gueclaw-agent/.env; then
        echo "   ℹ️  FILES_REPOSITORY_PATH já existe no .env"
    else
        echo "   ➕ Adicionando FILES_REPOSITORY_PATH ao .env"
        echo "" >> /opt/gueclaw-agent/.env
        echo "# ===== File Repository =====" >> /opt/gueclaw-agent/.env
        echo "# Directory where user-accessible files are stored (HTML, JSON, CSV, etc)" >> /opt/gueclaw-agent/.env
        echo "FILES_REPOSITORY_PATH=/opt/gueclaw-data/files" >> /opt/gueclaw-agent/.env
        echo "   ✅ FILES_REPOSITORY_PATH adicionado"
    fi
EOF

echo ""
echo "📦 Passo 2: Fazendo git pull das skills atualizadas..."
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211 << 'EOF'
    cd /opt/gueclaw-agent
    git pull origin main
    echo "   ✅ Skills atualizadas"
EOF

echo ""
echo "🔨 Passo 3: Rebuild do projeto..."
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211 << 'EOF'
    cd /opt/gueclaw-agent
    npm run build
    echo "   ✅ Build concluído"
EOF

echo ""
echo "🔄 Passo 4: Reiniciando PM2..."
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211 << 'EOF'
    pm2 restart gueclaw-agent
    echo "   ✅ PM2 reiniciado"
EOF

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "📊 Verificando configuração..."
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211 << 'EOF'
    echo ""
    echo "Variáveis de ambiente:"
    grep -E "MAX_ITERATIONS|FILES_REPOSITORY" /opt/gueclaw-agent/.env
    echo ""
    echo "Status PM2:"
    pm2 list
EOF

echo ""
echo "🧪 Teste agora via Telegram:"
echo "   'lista todos os arquivos do repositório'"
echo ""
