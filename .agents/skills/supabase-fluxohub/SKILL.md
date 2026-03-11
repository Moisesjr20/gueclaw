---
name: supabase-fluxohub
description: Conectar ao Supabase do FluxoHub para consultar workflows, execuções, nós e diagnósticos. Use quando precisar verificar status de execuções, listar workflows, consultar logs de erro, verificar configs de templates/email, ou diagnosticar problemas no FluxoHub. Requer variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY.
---

# Supabase FluxoHub Connector

Skill para acessar diretamente o banco de dados do FluxoHub no Supabase.

## Variáveis de Ambiente

```bash
export SUPABASE_URL="https://seu-projeto.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIs..."
```

## Comandos Rápidos

### Diagnóstico completo (recomendado)
```bash
python3 scripts/diagnose_workflow.py
```

### Ver últimas execuções
```bash
./scripts/check_executions.sh "0a6a8134-7631-40bb-a560-8f31db32356a"
```

### Ver logs de uma execução específica
```bash
./scripts/check_execution_logs.sh "UUID_DA_EXECUCAO"
```

### Ver status de todos os workflows
```bash
./scripts/list_workflows.sh
```

## Workflows Importantes (UUIDs)

| Workflow | UUID |
|----------|------|
| Contratos | `0a6a8134-7631-40bb-a560-8f31db32356a` |
| Aditivos | `f09cfcb1-bf88-4d34-ba76-a98b1da3de06` |

## User ID (Kyrius)
- `ec86fd8b-8e50-460b-a10d-348716693d02`

## Scripts Disponíveis

### Diagnóstico
- `check_executions.sh` - Últimas execuções de um workflow
- `check_execution_logs.sh` - Logs detalhados de uma execução
- `diagnose_workflow.sh` - Diagnóstico completo

### Listagens
- `list_workflows.sh` - Lista todos os workflows
- `list_nodes.sh` - Lista nós de um workflow
- `list_form_links.sh` - Lista short links

### Configurações
- `check_document_configs.sh` - Ver configs de templates
- `check_email_configs.sh` - Ver configs de email

### Consultas SQL
- `query.sql` - Query personalizada
- `recent_errors.sql` - Erros recentes

## Estrutura do Banco

Ver `references/database-schema.md` para schema completo.

## Testes da Skill

Execute testes para verificar se tudo está funcionando:

```bash
python3 scripts/test_skill.py
```

**Saída esperada:**
```
✅ Passaram: 7
❌ Falharam: 0
```

Se algum teste falhar, verifique:
1. Se as credenciais do Supabase estão corretas
2. Se o projeto Supabase está acessível
3. Se as tabelas existem no banco

---

## Exemplos de Uso

### Exemplo 1: Verificar por que um contrato não enviou email
```bash
# 1. Ver últimas execuções
python3 scripts/diagnose_workflow.py

# 2. Ou passo a passo:
./scripts/check_executions.sh "0a6a8134-7631-40bb-a560-8f31db32356a"
./scripts/check_execution_logs.sh "UUID_AQUI"
```

### Exemplo 2: Ver todos os workflows ativos
```bash
./scripts/list_workflows.sh
```

### Exemplo 3: Query SQL personalizada
```bash
./scripts/query.sh "SELECT * FROM nodes WHERE workflow_id = '...'"
```
