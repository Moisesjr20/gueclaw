-- ============================================
-- SCHEMA DO BANCO DE DADOS
-- Tabela para armazenar escritórios de advocacia
-- ============================================

-- Tabela principal de escritórios
CREATE TABLE escritorios_advocacia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Dados básicos
    nome VARCHAR(500) NOT NULL,
    nome_normalizado VARCHAR(500),  -- Para busca e deduplicação
    
    -- Endereço
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2) DEFAULT 'CE',
    cep VARCHAR(10),
    
    -- Contato
    telefone VARCHAR(50),
    telefone_formatado VARCHAR(50),
    email VARCHAR(255),
    email_normalizado VARCHAR(255),
    website VARCHAR(500),
    
    -- Validação
    email_valido BOOLEAN DEFAULT false,
    email_temporario BOOLEAN DEFAULT false,
    email_generico BOOLEAN DEFAULT false,
    qualidade VARCHAR(50),  -- '⭐⭐⭐ Excelente', '⭐⭐ Bom', '⭐ Regular'
    
    -- Fonte dos dados
    fonte VARCHAR(50) DEFAULT 'google_maps',  -- google_maps, website, manual
    google_maps_url TEXT,
    
    -- Metadados
    data_coleta DATE DEFAULT CURRENT_DATE,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Controle
    validado BOOLEAN DEFAULT false,
    contatado BOOLEAN DEFAULT false,
    observacoes TEXT,
    
    -- Campos adicionais (JSON flexível)
    metadados JSONB DEFAULT '{}'::jsonb
);

-- Índices para busca eficiente
CREATE INDEX idx_escritorios_cidade ON escritorios_advocacia(cidade);
CREATE INDEX idx_escritorios_email ON escritorios_advocacia(email);
CREATE INDEX idx_escritorios_qualidade ON escritorios_advocacia(qualidade);
CREATE INDEX idx_escritorios_data_coleta ON escritorios_advocacia(data_coleta);
CREATE INDEX idx_escritorios_nome ON escritorios_advocacia USING gin(to_tsvector('portuguese', nome));

-- Tabela de logs de contato (para CRM simples)
CREATE TABLE contatos_escritorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escritorio_id UUID REFERENCES escritorios_advocacia(id) ON DELETE CASCADE,
    
    data_contato TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_contato VARCHAR(50),  -- email, telefone, visita
    status VARCHAR(50),  -- enviado, respondido, negociacao, fechado, nao_interessado
    
    assunto TEXT,
    mensagem TEXT,
    resposta TEXT,
    
    usuario VARCHAR(100) DEFAULT 'sistema'
);

CREATE INDEX idx_contatos_escritorio ON contatos_escritorios(escritorio_id);
CREATE INDEX idx_contatos_data ON contatos_escritorios(data_contato);

-- View para dashboard
CREATE VIEW vw_escritorios_resumo AS
SELECT 
    cidade,
    qualidade,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE email_valido) as com_email_valido,
    COUNT(*) FILTER (WHERE contatado) as ja_contatados
FROM escritorios_advocacia
GROUP BY cidade, qualidade
ORDER BY cidade, total DESC;

-- Função para normalizar nome (remove acentos, lowercase)
CREATE OR REPLACE FUNCTION normalizar_texto(texto TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(texto, '[áàâãä]', 'a', 'gi'),
                '[éèêë]', 'e', 'gi'
            ),
            '[íìîï]', 'i', 'gi'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger para normalizar nomes automaticamente
CREATE OR REPLACE FUNCTION trigger_normalizar_escritorio()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nome_normalizado := normalizar_texto(NEW.nome);
    NEW.email_normalizado := lower(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_normalizar_escritorio
    BEFORE INSERT OR UPDATE ON escritorios_advocacia
    FOR EACH ROW
    EXECUTE FUNCTION trigger_normalizar_escritorio();

-- ============================================
-- EXEMPLOS DE CONSULTAS ÚTEIS
-- ============================================

-- Buscar por cidade
-- SELECT * FROM escritorios_advocacia WHERE cidade = 'Fortaleza';

-- Buscar por qualidade
-- SELECT * FROM escritorios_advocacia WHERE qualidade = '⭐⭐⭐ Excelente';

-- Buscar por email
-- SELECT * FROM escritorios_advocacia WHERE email ILIKE '%silva%';

-- Contar por cidade
-- SELECT cidade, COUNT(*) FROM escritorios_advocacia GROUP BY cidade ORDER BY COUNT(*) DESC;

-- Exportar para CSV (via psql)
-- \copy (SELECT nome, email, telefone, cidade FROM escritorios_advocacia WHERE email_valido) TO 'escritorios.csv' CSV HEADER;
