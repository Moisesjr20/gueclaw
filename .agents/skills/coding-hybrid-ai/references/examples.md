# Exemplos de Uso - Coding Hybrid AI

## Exemplo 1: Refactoring Completo

**Cenário:** Migrar sistema de autenticação de sessões para JWT

```bash
python scripts/hybrid_coding.py \
  --query "Migre o sistema de autenticação de sessões baseadas em cookies para JWT tokens. Atualize o middleware, handlers de login/logout, e adicione refresh tokens." \
  --context-dir ./src \
  --include "*.py" \
  --exclude "*test*,*__pycache__*" \
  --output ./jwt_migration.md
```

**Resultado esperado:**
- Fase 1: Kimi identifica `auth.py`, `middleware.py`, `models/user.py`
- Fase 2: DeepSeek gera código JWT otimizado
- Fase 3: Validação de imports e consistência

---

## Exemplo 2: Nova Feature

**Cenário:** Adicionar sistema de cache com Redis

```bash
python scripts/hybrid_coding.py \
  --query "Adicione um sistema de cache com Redis TTL configurável para as queries de relatório. Deve suportar invalidação por padrão e ter fallback para sem cache se Redis falhar." \
  --context-dir ./src/reports \
  --output ./redis_cache.md
```

---

## Exemplo 3: Otimização de Performance

**Cenário:** Query lenta em relatório mensal

```bash
python scripts/hybrid_coding.py \
  --query "Otimize a query de relatório mensal que está demorando 30s. Use índices apropriados, evite N+1 queries, e considere paginação ou caching." \
  --context-dir ./src/reports \
  --output ./query_optimization.md
```

---

## Exemplo 4: Usando Fases Separadas

**Passo 1 - Análise com Kimi:**
```bash
python scripts/kimi_filter.py \
  --query "Adicione validação de CPF em todos os formulários de cadastro" \
  --context-dir ./src \
  --output ./cpf_context.md
```

**Passo 2 - Geração com DeepSeek:**
```bash
python scripts/deepseek_generate.py \
  --query "Adicione validação de CPF em todos os formulários de cadastro" \
  --context-file ./cpf_context.md \
  --output ./cpf_validation.md
```

---

## Exemplo 5: Feature Complexa - Sistema de Notificações

```bash
python scripts/hybrid_coding.py \
  --query "Crie um sistema de notificações em tempo real usando WebSockets. Deve suportar notificações por usuário, marcar como lida, e ter fallback para polling se WebSocket falhar. Inclua modelo de dados, API REST, e handler WebSocket." \
  --context-dir ./src \
  --include "*.py" \
  --output ./notification_system.md
```

---

## Output Esperado

### Formato do Arquivo de Saída

```markdown
# Código Gerado - Coding Hybrid AI

## Resumo do Contexto (Fase 1)
Arquivos identificados: auth/middleware.py, auth/handlers.py, models/user.py
...

## Código Gerado (Fase 2)

### arquivo: src/auth/jwt_handler.py
```python
import jwt
from datetime import datetime, timedelta

class JWTHandler:
    ...
```

### arquivo: src/auth/middleware.py
```python
...
```

## Validação (Fase 3)
✅ Todas as importações verificadas
✅ Nomenclatura consistente
✅ Paths corretos
```

---

## Dicas de Uso

1. **Contexto muito grande?** Use `--exclude` para remover arquivos irrelevantes
2. **Query simples?** Use DeepSeek diretamente (sem a skill completa)
3. **Precisa de explicação?** Adicione "explique passo a passo" na query
4. **Performance crítica?** Especifique "foco em performance" na query

---

## Casos de Sucesso Reais

### Caso 1: Refactor de 50 arquivos
**Tempo estimado manual:** 2 dias
**Com Hybrid AI:** 45 minutos (incluindo revisão)
**Resultado:** Código gerado funcionou com ajustes mínimos

### Caso 2: Otimização de query
**Problema:** Query demorando 45s
**Sugestão DeepSeek:** Índice composto + prefetch_related
**Resultado:** Reduziu para 200ms

### Caso 3: Nova API REST
**Complexidade:** 15 endpoints, autenticação, validação
**Tempo com Hybrid AI:** 2 horas
**Tempo estimado manual:** 1 dia
