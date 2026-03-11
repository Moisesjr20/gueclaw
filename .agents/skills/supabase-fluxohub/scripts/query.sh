#!/bin/bash
# Query SQL personalizada

QUERY="$1"

if [ -z "$QUERY" ]; then
    echo "❌ Uso: $0 'SELECT * FROM workflows LIMIT 5'"
    exit 1
fi

echo "🔍 Executando query..."
echo ""

psql "$SUPABASE_URL" -c "$QUERY" 2>/dev/null || echo "❌ Erro na query"
