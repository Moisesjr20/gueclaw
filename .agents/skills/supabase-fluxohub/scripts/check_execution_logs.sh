#!/bin/bash
# Ver logs detalhados de uma execução

EXECUTION_ID="$1"

if [ -z "$EXECUTION_ID" ]; then
    echo "❌ Uso: $0 <execution_id>"
    echo "Exemplo: $0 123e4567-e89b-12d3-a456-426614174000"
    exit 1
fi

echo "🔍 Logs da execução: $EXECUTION_ID"
echo ""

psql "$SUPABASE_URL" -c "
SELECT 
    el.node_id,
    n.label as node_name,
    el.status,
    CASE 
        WHEN el.output IS NOT NULL THEN LEFT(el.output::text, 150)
        ELSE 'Sem output'
    END as output_preview,
    CASE 
        WHEN el.error IS NOT NULL THEN LEFT(el.error, 200)
        ELSE 'Sem erro'
    END as error_preview,
    el.created_at
FROM execution_logs el
LEFT JOIN nodes n ON el.node_id = n.id
WHERE el.execution_id = '$EXECUTION_ID'
ORDER BY el.created_at;
" 2>/dev/null || echo "❌ Erro: Verifique SUPABASE_URL e SUPABASE_SERVICE_KEY"
