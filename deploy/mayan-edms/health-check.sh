#!/bin/bash
# Mayan EDMS Health Check Script

set -e

VPS_HOST="147.93.69.211"
VPS_USER="root"
SSH_KEY="$HOME/.ssh/gueclaw_vps"

echo "🏥 Mayan EDMS Health Check"
echo "=========================="
echo ""

ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
#!/bin/bash

echo "📊 Container Status:"
echo "-------------------"
docker-compose -f /opt/mayan-edms/docker-compose.yml ps

echo ""
echo "💾 Resource Usage:"
echo "-----------------"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
echo "📝 Recent Logs:"
echo "--------------"
docker-compose -f /opt/mayan-edms/docker-compose.yml logs --tail=10

echo ""
echo "🔍 Service Health:"
echo "-----------------"
echo "PostgreSQL: $(docker exec mayan-postgres pg_isready -U mayan -d mayan 2>/dev/null && echo '✅ OK' || echo '❌ FAILED')"
echo "Redis: $(docker exec mayan-redis redis-cli ping 2>/dev/null && echo '✅ OK' || echo '❌ FAILED')"
echo "RabbitMQ: $(docker exec mayan-rabbitmq rabbitmq-diagnostics -q ping 2>/dev/null && echo '✅ OK' || echo '❌ FAILED')"
echo "Mayan: $(curl -sf http://localhost:8000/api/ >/dev/null && echo '✅ OK' || echo '❌ FAILED')"

echo ""
echo "📈 Disk Usage:"
echo "-------------"
du -sh /opt/mayan-edms/*

ENDSSH

echo ""
echo "🌐 Web Interface:"
echo "----------------"
curl -I https://docs.kyrius.com.br 2>/dev/null | head -5 || echo "⚠️  Web interface not accessible"
