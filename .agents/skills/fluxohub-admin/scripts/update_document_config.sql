-- ============================================
-- Atualizar configuração de template de documento
-- ============================================

-- Verificar config atual
SELECT * FROM workflow_document_configs
WHERE workflow_id = 'UUID_DO_WORKFLOW';

-- Atualizar template_id e folder_id
UPDATE workflow_document_configs
SET 
    template_id = 'NOVO_TEMPLATE_ID',
    folder_id = 'NOVO_FOLDER_ID',
    updated_at = NOW()
WHERE workflow_id = 'UUID_DO_WORKFLOW';

-- Ou inserir nova config (se não existir)
INSERT INTO workflow_document_configs (
    workflow_id,
    template_id,
    folder_id
) VALUES (
    'UUID_DO_WORKFLOW',
    'TEMPLATE_ID',
    'FOLDER_ID'
)
ON CONFLICT (workflow_id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    folder_id = EXCLUDED.folder_id,
    updated_at = NOW();
