-- ============================================
-- Listar todos os nós de um workflow
-- ============================================
-- Substitua UUID_WORKFLOW pelo ID do workflow

SELECT 
    id,
    label,
    node_type,
    position_x,
    position_y,
    created_at
FROM nodes
WHERE workflow_id = 'UUID_WORKFLOW'
ORDER BY label;

-- Contar total de nós
SELECT COUNT(*) as total_nodes
FROM nodes
WHERE workflow_id = 'UUID_WORKFLOW';
