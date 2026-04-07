#!/bin/bash
#
# Script de Backup Completo do GueClaw
# Implementa estratégia 3-2-1 com backups hourly/daily/monthly
#
# Uso: /opt/gueclaw-agent/scripts/backup-databases.sh
# Cron: 0 */6 * * * /opt/gueclaw-agent/scripts/backup-databases.sh >> /opt/gueclaw-agent/logs/backup.log 2>&1
#

set -e

# Configuração
DATA_DIR="/opt/gueclaw-data/databases"
BACKUP_DIR="/opt/gueclaw-data/backups"
EXTERNAL_DIR="/opt/backups/gueclaw"
TIMESTAMP=$(date '+%Y-%m-%d_%Hh')
DATE=$(date '+%Y-%m-%d')
MONTH=$(date '+%Y-%m')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 GueClaw Database Backup - $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Função de backup
backup_db() {
    local DB_NAME=$1
    local DB_PATH="${DATA_DIR}/${DB_NAME}.db"
    
    if [ ! -f "$DB_PATH" ]; then
        echo "⚠️  Database not found: $DB_PATH"
        return 1
    fi
    
    local SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo ""
    echo "📦 Backing up ${DB_NAME}.db (${SIZE})..."
    
    # Hourly backup (comprimido com gzip)
    echo "   → Creating hourly backup..."
    sqlite3 "$DB_PATH" ".backup /tmp/${DB_NAME}_temp.db"
    
    if [ $? -eq 0 ]; then
        gzip -c "/tmp/${DB_NAME}_temp.db" > "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz"
        rm "/tmp/${DB_NAME}_temp.db"
        echo "   ✅ Hourly backup: ${DB_NAME}_${TIMESTAMP}.db.gz"
    else
        echo "   ❌ Failed to create backup for ${DB_NAME}"
        return 1
    fi
    
    # Daily backup (apenas 1x por dia às 3h ou primeira execução do dia)
    LAST_DAILY=$(ls -t "${BACKUP_DIR}/daily/${DB_NAME}_${DATE}"*.db.gz 2>/dev/null | head -1)
    if [ -z "$LAST_DAILY" ]; then
        echo "   → Creating daily backup..."
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${BACKUP_DIR}/daily/${DB_NAME}_${DATE}.db.gz"
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${EXTERNAL_DIR}/daily/${DB_NAME}_${DATE}.db.gz"
        echo "   ✅ Daily backup: ${DB_NAME}_${DATE}.db.gz"
    fi
    
    # Monthly backup (dia 1 de cada mês ou primeiro backup do mês)
    LAST_MONTHLY=$(ls -t "${BACKUP_DIR}/monthly/${DB_NAME}_${MONTH}"*.db.gz 2>/dev/null | head -1)
    if [ -z "$LAST_MONTHLY" ]; then
        echo "   → Creating monthly backup..."
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${BACKUP_DIR}/monthly/${DB_NAME}_${MONTH}.db.gz"
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${EXTERNAL_DIR}/monthly/${DB_NAME}_${MONTH}.db.gz"
        echo "   ✅ Monthly backup: ${DB_NAME}_${MONTH}.db.gz"
    fi
}

# Criar diretórios se não existirem
mkdir -p "${BACKUP_DIR}"/{hourly,daily,monthly}
mkdir -p "${EXTERNAL_DIR}"/{hourly,daily,monthly}

# Backup de cada banco
backup_db "gueclaw"
backup_db "leads"

# Tentar backup do financeiro (pode não existir)
if [ -f "${DATA_DIR}/financas.db" ]; then
    backup_db "financas"
fi

echo ""
echo "🧹 Cleaning old backups..."

# Limpeza de backups antigos
# Hourly: mantém últimas 24h (4 backups = 1 dia com freq de 6h)
DELETED_HOURLY=$(find "${BACKUP_DIR}/hourly" -name "*.db.gz" -mtime +1 -delete -print | wc -l)
echo "   → Deleted ${DELETED_HOURLY} old hourly backups"

# Daily: mantém últimos 30 dias
DELETED_DAILY=$(find "${BACKUP_DIR}/daily" -name "*.db.gz" -mtime +30 -delete -print | wc -l)
DELETED_DAILY_EXT=$(find "${EXTERNAL_DIR}/daily" -name "*.db.gz" -mtime +30 -delete -print | wc -l)
echo "   → Deleted ${DELETED_DAILY} local + ${DELETED_DAILY_EXT} external daily backups"

# Monthly: mantém últimos 12 meses
DELETED_MONTHLY=$(find "${BACKUP_DIR}/monthly" -name "*.db.gz" -mtime +365 -delete -print | wc -l)
DELETED_MONTHLY_EXT=$(find "${EXTERNAL_DIR}/monthly" -name "*.db.gz" -mtime +365 -delete -print | wc -l)
echo "   → Deleted ${DELETED_MONTHLY} local + ${DELETED_MONTHLY_EXT} external monthly backups"

echo ""
echo "📊 Backup Statistics:"
echo "   Hourly backups:  $(ls "${BACKUP_DIR}/hourly" | wc -l) files"
echo "   Daily backups:   $(ls "${BACKUP_DIR}/daily" | wc -l) files"
echo "   Monthly backups: $(ls "${BACKUP_DIR}/monthly" | wc -l) files"

TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
EXTERNAL_SIZE=$(du -sh "${EXTERNAL_DIR}" | cut -f1)
echo "   Total size:      ${TOTAL_SIZE} (internal) + ${EXTERNAL_SIZE} (external)"

echo ""
echo "✅ Backup completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
