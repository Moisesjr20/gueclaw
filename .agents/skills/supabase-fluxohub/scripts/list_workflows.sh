#!/bin/bash
# Listar todos os workflows

echo "📋 WORKFLOWS CADASTRADOS"
echo "────────────────────────────────────────────────"

psql "$SUPABASE_URL" -c "
SELECT 
    id,
    name,
    is_active,
    created_at
FROM workflows
ORDER BY created_at DESC
LIMIT 20;
" 2>/dev/null || echo "❌ Erro ao consultar"
