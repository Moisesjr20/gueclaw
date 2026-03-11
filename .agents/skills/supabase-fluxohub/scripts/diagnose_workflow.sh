#!/bin/bash
# Diagnóstico completo de um workflow

WORKFLOW_ID="${1:-0a6a8134-7631-40bb-a560-8f31db32356a}"

echo "═══════════════════════════════════════════════════"
echo "🔬 DIAGNÓSTICO DO WORKFLOW"
echo "   ID: $WORKFLOW_ID"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. Info do workflow
echo "📋 1. INFORMAÇÕES DO WORKFLOW"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT id, name, is_active, created_at, updated_at
FROM workflows
WHERE id = '$WORKFLOW_ID';
" 2>/dev/null
echo ""

# 2. Nós do workflow
echo "📦 2. NÓS DO WORKFLOW"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT id, label, node_type, position_x, position_y
FROM nodes
WHERE workflow_id = '$WORKFLOW_ID'
ORDER BY label;
" 2>/dev/null
echo ""

# 3. Últimas execuções
echo "⚡ 3. ÚLTIMAS 5 EXECUÇÕES"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT id, status, 
       CASE WHEN error_message IS NOT NULL THEN LEFT(error_message, 80) ELSE 'OK' END as erro,
       created_at
FROM executions
WHERE workflow_id = '$WORKFLOW_ID'
ORDER BY created_at DESC
LIMIT 5;
" 2>/dev/null
echo ""

# 4. Config de documento
echo "📄 4. CONFIGURAÇÃO DE TEMPLATE"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT workflow_id, template_id, folder_id
FROM workflow_document_configs
WHERE workflow_id = '$WORKFLOW_ID';
" 2>/dev/null
echo ""

# 5. Config de email
echo "📧 5. CONFIGURAÇÃO DE EMAIL"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT workflow_id, recipients, subject_template
FROM workflow_email_configs
WHERE workflow_id = '$WORKFLOW_ID';
" 2>/dev/null
echo ""

# 6. Short links
echo "🔗 6. SHORT LINKS"
echo "───────────────────────────────────────────────────"
psql "$SUPABASE_URL" -c "
SELECT short_code, form_type, is_active, created_at
FROM form_links
WHERE workflow_id = '$WORKFLOW_ID';
" 2>/dev/null
echo ""

echo "═══════════════════════════════════════════════════"
echo "✅ Diagnóstico completo!"
echo "═══════════════════════════════════════════════════"
