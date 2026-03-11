-- ============================================
-- Atualizar código de um nó específico
-- ============================================
-- Substitua UUID_DO_NÓ pelo ID real do nó
-- Substitua o código entre aspas simples

UPDATE nodes
SET code = 'COLE_O_NOVO_CODIGO_AQUI',
    updated_at = NOW()
WHERE id = 'UUID_DO_NÓ';

-- Verificar atualização
SELECT id, label, LEFT(code, 100) as code_preview
FROM nodes
WHERE id = 'UUID_DO_NÓ';
