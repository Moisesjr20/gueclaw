#!/bin/bash
# Listar nós de um workflow

WORKFLOW_ID="${1:-0a6a8134-7631-40bb-a560-8f31db32356a}"

echo "📦 NÓS DO WORKFLOW: $WORKFLOW_ID"
echo ""

psql "$SUPABASE_URL" -c "
SELECT 
    id,
    label,
    node_type,
    LEFT(code, 100) as code_preview
FROM nodes
WHERE workflow_id = '$WORKFLOW_ID'
ORDER BY label;
" 2>/dev/null || echo "❌ Erro ao consultar"
