#!/bin/bash
# install.sh - Instala dependências em Linux (VPS)

echo "[GueClaw] Iniciando instalacao em Linux..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "[!] Node.js nao encontrado. Por favor instale o Node.js v20+."
    exit 1
fi

echo "[1/4] Instalando dependencias NPM..."
npm install

echo "[2/4] Criando diretorios base..."
mkdir -p data tmp .agents/skills execution || true

echo "[3/4] Compilando TypeScript..."
npm run build

echo "[4/4] Configurando .env (caso nao exista)..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[!] Arquivo .env criado. Edite com suas chaves!"
else
    echo "[!] Arquivo .env ja existe."
fi

echo "[V] Instalacao concluida! Para rodar: npm start"
