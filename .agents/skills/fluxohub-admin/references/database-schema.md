-- ============================================
-- Schema da tabela NODES
-- ============================================

CREATE TABLE nodes (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    user_id UUID NOT NULL,
    node_type TEXT NOT NULL,          -- ex: code, formTrigger, output
    label TEXT,                        -- nome exibido no workflow
    position_x NUMERIC,
    position_y NUMERIC,
    code TEXT,                         -- código JavaScript (para nós code)
    input_schema JSONB,
    output_schema JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    retry_policy JSONB
);

-- ============================================
-- Schema da tabela WORKFLOWS
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    retry_policy JSONB,
    environment TEXT DEFAULT 'production'
);

-- ============================================
-- Schema da tabela EDGES
-- ============================================

CREATE TABLE edges (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    source TEXT NOT NULL,              -- ID do nó origem
    target TEXT NOT NULL,              -- ID do nó destino
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Schema da tabela WORKFLOW_DOCUMENT_CONFIGS
-- ============================================

CREATE TABLE workflow_document_configs (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL,
    template_id TEXT NOT NULL,         -- Google Docs Template ID
    folder_id TEXT,                    -- Pasta para salvar documentos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Schema da tabela FORM_LINKS
-- ============================================

CREATE TABLE form_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    short_code TEXT NOT NULL UNIQUE,   -- ex: contratos, aditivos
    form_type TEXT,                    -- ex: contrato, aditivo
    name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX idx_nodes_workflow_id ON nodes(workflow_id);
CREATE INDEX idx_edges_workflow_id ON edges(workflow_id);
CREATE INDEX idx_form_links_short_code ON form_links(short_code);
