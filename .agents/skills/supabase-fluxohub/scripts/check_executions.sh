#!/bin/bash
# Ver últimas execuções de um workflow (com credenciais do FluxoHub)

WORKFLOW_ID="${1:-0a6a8134-7631-40bb-a560-8f31db32356a}"

# Credenciais do FluxoHub
SUPABASE_URL="https://pzzmmaachshasiijopbw.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6em1tYWFjaHNoYXNpaWpvcGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMjUwMiwiZXhwIjoyMDg2OTA4NTAyfQ._L2zZUn2lpBsQJetGaVx2GcE2Poi0ZEhQkJk602OgMc"

echo "🔍 Últimas execuções do workflow: $WORKFLOW_ID"
echo ""

export PGPASSWORD="${SUPABASE_SERVICE_KEY#*password=}"
psql "${SUPABASE_URL/postgresql:\/\//postgresql:\/\/postgres:${SUPABASE_SERVICE_KEY}@}" -c "
SELECT 
    id,
    status,
    CASE 
        WHEN error_message IS NOT NULL THEN LEFT(error_message, 100)
        ELSE 'Nenhum erro'
    END as error_preview,
    started_at,
    completed_at,
    created_at
FROM executions
WHERE workflow_id = '$WORKFLOW_ID'
ORDER BY created_at DESC
LIMIT 10;
" 2>/dev/null || echo "❌ Erro ao conectar"
