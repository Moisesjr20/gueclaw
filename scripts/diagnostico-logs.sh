#!/bin/bash
# Script para capturar logs de diagnóstico do GueClaw
# Uso: ./diagnostico-logs.sh

echo "🔍 DIAGNÓSTICO DE LOGS - GueClaw Agent"
echo "======================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está na VPS
if [ ! -d "/opt/gueclaw-agent" ]; then
    echo -e "${RED}❌ Erro: Este script deve ser executado na VPS${NC}"
    echo "Execute: ssh root@147.93.69.211"
    exit 1
fi

cd /opt/gueclaw-agent

echo "📋 Capturando logs dos últimos 200 eventos..."
echo ""

# Capturar logs com DEBUG do LLM
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 LLM RESPONSE DEBUG LOGS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs gueclaw --lines 500 --nostream 2>/dev/null | grep -A 15 "🔍 LLM RESPONSE DEBUG" | tail -n 100

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ ÚLTIMOS ERROS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs gueclaw --lines 200 --nostream 2>/dev/null | grep -i "error\|fail\|❌" | tail -n 30

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  MAX ITERATIONS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs gueclaw --lines 200 --nostream 2>/dev/null | grep -i "max iterations\|MAX_ITERATIONS" | tail -n 20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 TOOL EXECUTIONS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs gueclaw --lines 200 --nostream 2>/dev/null | grep "Tool Calls Count:\|Tool Names:" | tail -n 20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ANÁLISE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Contar tool calls com sucesso vs. zero
TOOL_CALLS_ZERO=$(pm2 logs gueclaw --lines 500 --nostream 2>/dev/null | grep "Tool Calls Count: 0" | wc -l)
TOOL_CALLS_SUCCESS=$(pm2 logs gueclaw --lines 500 --nostream 2>/dev/null | grep "Tool Calls Count: [1-9]" | wc -l)

echo "Tool Calls Count = 0 (sem execução): $TOOL_CALLS_ZERO"
echo "Tool Calls Count > 0 (com execução): $TOOL_CALLS_SUCCESS"

if [ "$TOOL_CALLS_ZERO" -gt "$TOOL_CALLS_SUCCESS" ]; then
    echo -e "${RED}❌ PROBLEMA CONFIRMADO: Agent não está executando tools${NC}"
    echo -e "${YELLOW}⚡ SOLUÇÃO: Implementar System Prompt ACTION-FIRST${NC}"
else
    echo -e "${GREEN}✅ Agent está executando tools corretamente${NC}"
fi

# Contar finish reasons
FINISH_STOP=$(pm2 logs gueclaw --lines 500 --nostream 2>/dev/null | grep "Finish Reason: stop" | wc -l)
FINISH_TOOL_CALLS=$(pm2 logs gueclaw --lines 500 --nostream 2>/dev/null | grep "Finish Reason: tool_calls" | wc -l)

echo ""
echo "Finish Reason = stop (texto livre): $FINISH_STOP"
echo "Finish Reason = tool_calls (ferramentas): $FINISH_TOOL_CALLS"

if [ "$FINISH_STOP" -gt "$FINISH_TOOL_CALLS" ]; then
    echo -e "${RED}❌ PROBLEMA: LLM está gerando texto livre ao invés de tool calls${NC}"
    echo -e "${YELLOW}⚡ SOLUÇÃO: Melhorar System Prompt para forçar function calling${NC}"
else
    echo -e "${GREEN}✅ LLM está gerando tool calls corretamente${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Logs completos salvos em: /tmp/gueclaw-diagnostico-$(date +%Y%m%d-%H%M%S).log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Salvar logs completos
LOG_FILE="/tmp/gueclaw-diagnostico-$(date +%Y%m%d-%H%M%S).log"
pm2 logs gueclaw --lines 1000 --nostream > "$LOG_FILE" 2>&1

echo ""
echo -e "${GREEN}✅ Diagnóstico completo!${NC}"
echo ""
echo "Próximos passos:"
echo "1. Analise os logs acima"
echo "2. Se 'Tool Calls Count = 0' for alto, implemente System Prompt ACTION-FIRST"
echo "3. Execute: pm2 restart gueclaw"
echo "4. Teste no Telegram: 'Liste os containers docker'"
