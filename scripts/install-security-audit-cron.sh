#!/bin/bash
#
# 🔒 Instalador de Cron Job - Security Audit
# Configura varredura de segurança diária às 6h da manhã
#

set -euo pipefail

echo "🔒 GueClaw Security Audit - Instalador de Cron Job"
echo "=================================================="
echo ""

# Verifica se está rodando na VPS
if [ ! -d "/opt/gueclaw-agent" ]; then
    echo "❌ Este script deve ser executado na VPS!"
    echo "   Execute via SSH: bash /opt/gueclaw-agent/scripts/install-security-audit-cron.sh"
    exit 1
fi

# Caminho do script Python
SCRIPT_PATH="/opt/gueclaw-agent/scripts/security-audit-vps.py"
LOG_FILE="/var/log/gueclaw-security-audit.log"

# Verifica se o script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Script não encontrado: $SCRIPT_PATH"
    exit 1
fi

# Torna o script executável
chmod +x "$SCRIPT_PATH"
echo "✅ Permissão de execução concedida ao script"

# Cron job: todos os dias às 6h
CRON_SCHEDULE="0 6 * * *"
CRON_COMMAND="cd /opt/gueclaw-agent && /usr/bin/python3 $SCRIPT_PATH >> $LOG_FILE 2>&1"
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

# Verifica se o cron job já existe
if crontab -l 2>/dev/null | grep -q "security-audit-vps.py"; then
    echo "⚠️  Cron job já existe. Removendo versão antiga..."
    crontab -l 2>/dev/null | grep -v "security-audit-vps.py" | crontab -
fi

# Adiciona o novo cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job configurado com sucesso!"
echo ""
echo "📅 Agendamento: Todos os dias às 6h da manhã"
echo "📝 Logs: $LOG_FILE"
echo ""
echo "Para verificar se foi instalado corretamente:"
echo "   crontab -l | grep security-audit"
echo ""
echo "Para executar manualmente agora:"
echo "   cd /opt/gueclaw-agent && python3 $SCRIPT_PATH"
echo ""
echo "Para ver os logs:"
echo "   tail -f $LOG_FILE"
echo ""

# Criar arquivo de log se não existir
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

echo "🎯 Para testar agora, execute:"
echo "   cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"
echo ""
echo "✅ Instalação concluída!"
