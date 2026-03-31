#!/bin/bash
#
# Script de Backup Criptografado do Banco de Dados GueClaw
# Executa backup diário do SQLite e criptografa com GPG
#
# Instalação no cron (VPS):
# 0 3 * * * /opt/gueclaw-agent/scripts/backup-database.sh >> /var/log/gueclaw-backup.log 2>&1
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuração
DB_PATH="${PROJECT_ROOT}/data/gueclaw.db"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/gueclaw}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_BACKUP="/tmp/gueclaw_backup_${TIMESTAMP}.db"
ENCRYPTED_BACKUP="${BACKUP_DIR}/gueclaw_${TIMESTAMP}.db.gpg"

# Chave de criptografia do .env ou variável de ambiente
if [ -f "${PROJECT_ROOT}/.env" ]; then
    source <(grep -E '^DATABASE_ENCRYPTION_KEY=' "${PROJECT_ROOT}/.env" | sed 's/^/export /')
fi

if [ -z "$DATABASE_ENCRYPTION_KEY" ]; then
    echo "❌ ERROR: DATABASE_ENCRYPTION_KEY not set"
    exit 1
fi

echo "🔄 GueClaw Database Backup - $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Verificar se banco existe
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found: $DB_PATH"
    exit 1
fi

# Fazer backup usando sqlite3
echo "📦 Creating backup from $DB_PATH..."
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_PATH" ".backup '$TEMP_BACKUP'"
else
    # Fallback: copy direto (menos seguro, mas funciona)
    cp "$DB_PATH" "$TEMP_BACKUP"
fi

# Verificar tamanho do backup
BACKUP_SIZE=$(du -h "$TEMP_BACKUP" | cut -f1)
echo "✅ Backup created: ${BACKUP_SIZE}"

# Criptografar com GPG usando a chave do ambiente
echo "🔐 Encrypting backup with AES-256..."
echo "$DATABASE_ENCRYPTION_KEY" | gpg --symmetric \
    --cipher-algo AES256 \
    --batch \
    --yes \
    --passphrase-fd 0 \
    --output "$ENCRYPTED_BACKUP" \
    "$TEMP_BACKUP"

# Remover backup temporário não criptografado
rm -f "$TEMP_BACKUP"

if [ -f "$ENCRYPTED_BACKUP" ]; then
    ENCRYPTED_SIZE=$(du -h "$ENCRYPTED_BACKUP" | cut -f1)
    echo "✅ Encrypted backup: ${ENCRYPTED_SIZE} → $ENCRYPTED_BACKUP"
else
    echo "❌ Failed to create encrypted backup"
    exit 1
fi

# Limpar backups antigos (manter apenas últimos N dias)
echo "🧹 Cleaning old backups (retention: ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "gueclaw_*.db.gpg" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING=$(find "$BACKUP_DIR" -name "gueclaw_*.db.gpg" -type f | wc -l)
echo "✅ Retained backups: $REMAINING"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Backup completed successfully!"
echo ""

# Listar últimos 5 backups
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR"/gueclaw_*.db.gpg | tail -n 5 | awk '{print "   " $9 " (" $5 ")"}'
echo ""
