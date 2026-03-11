---
name: fluxohub-admin
description: Administrar workflows, nós e configurações do FluxoHub. Use quando precisar modificar código de nós de workflow, atualizar workflows, consultar estrutura do banco de dados, listar workflows/nós, ou gerenciar templates de documentos Google Docs no FluxoHub.
---

# FluxoHub Admin

Skill para administração e manutenção da plataforma FluxoHub.

## Quando Usar Esta Skill

Use esta skill quando:
1. Precisar atualizar código de nós em workflows (banco de dados)
2. Modificar configurações de workflows (banco de dados)
3. Consultar estrutura do banco de dados
4. Listar workflows, nós ou edges
5. Gerenciar templates de documentos Google Docs
6. Criar ou atualizar short links de formulários
7. Modificar arquivos no servidor (HTML, CSS, JS)
8. Reiniciar serviços Docker
9. Alterar código fonte da aplicação

## Capacidades

### ✅ CONSIGO FAZER:

**Banco de Dados (Supabase/PostgreSQL):**
- CRUD completo: workflows, nós, edges, configs, short links
- Atualizar código JavaScript de nós
- Consultar schemas e dados

**Sistema de Arquivos:**
- Ler, criar, editar arquivos (HTML, CSS, JS, SQL)
- Modificar formulários no servidor
- Atualizar código fonte da aplicação

**Docker:**
- Reiniciar containers
- Ver logs de serviços
- Executar comandos em containers

### ❌ NÃO CONSIGO FAZER:

**Variáveis de Ambiente:**
- Modificar arquivos `.env`
- Alterar secrets ou credenciais sensíveis

## Estrutura do Banco de Dados

### Tabelas Principais

| Tabela | Descrição | Colunas Principais |
|--------|-----------|-------------------|
| `workflows` | Workflows criados | id, user_id, name, description, is_active, created_at, updated_at |
| `nodes` | Nós dos workflows | id, workflow_id, user_id, node_type, label, code, position_x, position_y |
| `edges` | Conexões entre nós | id, workflow_id, source, target, created_at |
| `workflow_document_configs` | Configs de templates | id, workflow_id, template_id, folder_id |
| `workflow_email_configs` | Configs de email | id, workflow_id, recipients, subject_template |
| `form_links` | Short links de formulários | id, user_id, workflow_id, short_code, form_type |
| `executions` | Execuções de workflows | id, workflow_id, status, started_at, completed_at |

### UUIDs Importantes

**Workflows:**
- Contratos: `0a6a8134-7631-40bb-a560-8f31db32356a`
- Aditivos: `f09cfcb1-bf88-4d34-ba76-a98b1da3de06`

**User ID (Kyrius):**
- `ec86fd8b-8e50-460b-a10d-348716693d02`

## Operações Comuns

### 1. Atualizar Código de um Nó

Ver arquivo: `scripts/update_node_code.sql`

```sql
UPDATE nodes 
SET code = 'const input = triggerOutput?.output || {}; ...',
    updated_at = NOW() 
WHERE id = 'UUID_DO_NÓ';
```

### 2. Listar Nós de um Workflow

```sql
SELECT id, label, node_type 
FROM nodes 
WHERE workflow_id = 'UUID_WORKFLOW'
ORDER BY label;
```

### 3. Buscar Nó por Label

```sql
SELECT id, label, code 
FROM nodes 
WHERE workflow_id = 'UUID_WORKFLOW' 
  AND label ILIKE '%nome do nó%';
```

### 4. Criar Short Link

```sql
INSERT INTO form_links (user_id, workflow_id, short_code, form_type, name, is_active)
VALUES (
  'ec86fd8b-8e50-460b-a10d-348716693d02',
  'UUID_WORKFLOW',
  'nome-curto',
  'contrato',
  'Descrição',
  true
);
```

## Templates de Documentos

### IDs dos Templates Google Docs

| Produto | Template ID |
|---------|-------------|
| Titan 12M | `1zYuJKQaoBgDPMQWEGcovwxozNNjDTJX1dodlPM0GOL0` |
| Titan 6M | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` |
| Titan Black | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` |
| Acelerador Empresarial | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` |
| Lendário | `11nBGI55qnEdRop7lODMfHHKdur1U6mrEpCKy_ua9uk0` |
| Aditivos | `1kM5DWjqsbSYvpmEuRB05oy1SUAAT39zQXT4hhqomrRk` |

### Pasta de Documentos Gerados

Folder ID: `12srnA2T3RKE6Utf7aqu3CrP7BkK2KaSPZU3komgF543owsV8AzFuWGMmF3aqOOMWzmtDQYsq`

## Tipos de Nós

| node_type | Descrição |
|-----------|-----------|
| `formTrigger` | Trigger de formulário HTML |
| `code` | Nó com código JavaScript |
| `output` | Nó de saída/retorno |
| `switch` | Nó de roteamento condicional |
| `googleDocs` | Geração de documentos Google |
| `email` | Envio de email |

## Variáveis de Placeholder (Contratos)

### Dados Pessoais
- `{{nome}}`, `{{nacionalidade}}`, `{{profissão}}`, `{{estadocivil}}`
- `{{cpncnpj}}`, `{{rg}}`, `{{telefone}}`, `{{email}}`

### Endereço
- `{{Rua}}`, `{{Numero}}`, `{{Complemento}}`, `{{Bairro}}`, `{{CEP}}`

### Contrato
- `{{produto}}`, `{{ValorContrato}}`, `{{duracao}}`
- `{{valormentoria90%}}`, `{{valormentoria10%}}`
- `{{formadepagamento}}`, `{{Parcela}}`, `{{Entrada}}`, `{{Dia}}`
- `{{dataincio}}`, `{{dataatual}}`, `{{hoje}}`

## Scripts Disponíveis

Ver diretório `scripts/`:
- `update_node_code.sql` - Atualizar código de nó
- `list_workflow_nodes.sql` - Listar nós de workflow
- `create_form_link.sql` - Criar short link
- `update_document_config.sql` - Atualizar config de template

## Referências

Ver diretório `references/`:
- `database-schema.md` - Schema completo do banco
- `node-examples.md` - Exemplos de código de nós
- `template-variables.md` - Variáveis de templates
