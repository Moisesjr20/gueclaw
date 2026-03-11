-- ============================================
-- Criar short link para formulário
-- ============================================

INSERT INTO public.form_links (
    user_id,
    workflow_id,
    short_code,
    form_type,
    name,
    is_active
) VALUES (
    'ec86fd8b-8e50-460b-a10d-348716693d02',  -- User ID Kyrius
    'UUID_DO_WORKFLOW',                         -- Substitua pelo workflow_id
    'nome-curto',                               -- Ex: contratos, aditivos
    'contrato',                                 -- ou aditivo
    'Nome do Formulário',
    true
);

-- Verificar criação
SELECT short_code, workflow_id, is_active
FROM public.form_links
WHERE short_code = 'nome-curto';
