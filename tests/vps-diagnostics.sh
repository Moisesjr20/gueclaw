#!/bin/bash
# VPS Diagnostics Script
# Execute: ssh root@147.93.69.211 'bash -s' < vps-diagnostics.sh

echo "======================================"
echo "  VPS DIAGNOSTICS - GueClaw API"
echo "======================================"
echo ""

echo "[1/7] PM2 Status"
echo "---"
pm2 status
echo ""

echo "[2/7] PM2 Logs (últimas 30 linhas)"
echo "---"
pm2 logs gueclaw-agent --lines 30 --nostream
echo ""

echo "[3/7] Porta 3022 (Server listening?)"
echo "---"
netstat -tuln | grep 3022 || echo "Porta 3022 NÃO ESTÁ ABERTA"
echo ""

echo "[4/7] Processos Node.js"
echo "---"
ps aux | grep node | grep -v grep
echo ""

echo "[5/7] Test API Local"
echo "---"
curl -s http://localhost:3022/api/status || echo "API não responde em localhost:3022"
echo ""

echo "[6/7] Firewall Status"
echo "---"
ufw status | grep 3022 || echo "Porta 3022 não configurada no firewall"
echo ""

echo "[7/7] Disk & Memory"
echo "---"
df -h / | tail -1
free -h | grep Mem
echo ""

echo "======================================"
echo "  DIAGNÓSTICO COMPLETO"
echo "======================================"
