# 🧠 GueClaw Memory MCP Server - Guia de Uso

**Data:** 13/04/2026  
**Versão:** 1.0.0  
**Status:** ✅ PRODUÇÃO

---

## 📊 VISÃO GERAL

O GueClaw Memory MCP Server implementa o padrão **Progressive Disclosure** para busca eficiente de memórias extraídas, economizando até **73% em tokens** vs carregamento completo.

### Arquitetura de 3 Camadas

```
Layer 1: SEARCH      (~50-100 tokens/result)  → Index compacto
Layer 2: TIMELINE    (~200-300 tokens)        → Contexto cronológico  
Layer 3: GET         (~500-1K tokens/result)  → Detalhes completos
```

---

## 🚀 QUICKSTART

### 1. Ativar MCP Server no VS Code

O servidor já está configurado em `config/mcp-servers.json`:

```json
{
  "servers": {
    "gueclaw-memory": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/memory-server.ts"],
      "env": {
        "DATABASE_PATH": "${env:DATABASE_PATH}",
        "DATABASE_ENCRYPTION_KEY": "${env:DATABASE_ENCRYPTION_KEY}",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Para ativar:**
1. Abra VS Code
2. Reload Window (`Ctrl+Shift+P` → "Developer: Reload Window")
3. O servidor starta automaticamente quando usar Copilot Chat

### 2. Verificar  que está funcionando

No terminal do VS Code, você deverá ver:

```
✅ GueClaw Memory MCP Server v1.0.0 running
📊 Progressive Disclosure enabled (3-layer workflow)
🔍 Tools: search, timeline, get
💡 Use Layer 1 (search) → Layer 2 (timeline) → Layer 3 (get) for optimal token usage
```

---

## 🔍 FERRAMENTAS DISPONÍVEIS

### 1. `gueclaw_memory_search` (Layer 1)

**Descrição:** Busca índice compacto de memórias (~50-100 tokens/result)

**Quando usar:** Primeira etapa - descobrir memórias relevantes

**Parâmetros:**
- `query` (string, obrigatório): Query de busca natural ou palavras-chave
- `type` (string, opcional): Filtrar por tipo (`preference`, `decision`, `fact`, `goal`, `skill`, `constraint`, `context`)
- `importance` (string, opcional): Filtrar por importância (`low`, `medium`, `high`, `critical`)
- `limit` (number, opcional): Máximo de resultados (padrão: 10, máx: 50)
- `minConfidence` (number, opcional): Confiança mínima 0-1 (padrão: 0.7)
- `userId` (string, opcional): Filtrar por usuário (padrão: "all")

**Exemplo:**
```typescript
// No Copilot Chat:
@github Busque decisões sobre OAuth

// Tool call:
gueclaw_memory_search({
  query: "OAuth",
  type: "decision",
  limit: 5
})

// Response:
{
  "results": [
    {
      "id": "mem_1712001234567_abc123",
      "title": "Implementar OAuth 2.0 + PKCE",
      "type": "decision",
      "importance": "high",
      "confidence": 0.95,
      "date": "2026-04-01T11:55:00Z",
      "tags": ["oauth", "security", "mobile"]
    }
  ],
  "totalResults": 1,
  "tokensUsed": 287,
  "nextSteps": [
    "Use gueclaw_memory_timeline(memoryId) to see context...",
    "Use gueclaw_memory_get(ids: [...]) to fetch full details..."
  ]
}
```

---

### 2. `gueclaw_memory_timeline` (Layer 2)

**Descrição:** Contexto cronológico ao redor de uma memória (~200-300 tokens)

**Quando usar:** Para entender "o que estava acontecendo" antes/depois de uma decisão

**Parâmetros:**
- `memoryId` (string, obrigatório): ID da memória (do search)
- `before` (number, opcional): Memórias anteriores (padrão: 3, máx: 10)
- `after` (number, opcional): Memórias posteriores (padrão: 3, máx: 10)

**Exemplo:**
```typescript
// No Copilot Chat:
@github Me dê o contexto sobre #mem_1712001234567_abc123

// Tool call:
gueclaw_memory_timeline({
  memoryId: "mem_1712001234567_abc123",
  before: 3,
  after: 3
})

// Response:
{
  "timeline": [
    {
      "id": "mem_..._xyz1",
      "date": "2026-03-31T10:14:00Z",
      "type": "preference",
      "content": "Prefere soluções type-safe",
      "importance": "medium",
      "relativePosition": -3
    },
    // ... more before ...
    {
      "id": "mem_1712001234567_abc123",
      "date": "2026-04-01T11:55:00Z",
      "type": "decision",
      "content": "Implementar OAuth 2.0 + PKCE",
      "context": "Após análise de vulnerabilidades CSRF",
      "importance": "high",
      "confidence": 0.95,
      "tags": ["oauth", "security"],
      "relativePosition": 0,
      "isTarget": true
    },
    // ... more after ...
  ],
  "centerMemory": { /* full center details */ },
  "tokensUsed": 854
}
```

---

### 3. `gueclaw_memory_get` (Layer 3)

**Descrição:** Detalhes completos de memórias (~500-1K tokens/result)

**Quando usar:** Última etapa - carregar detalhes completos após filtrar

**Parâmetros:**
- `ids` (string[], obrigatório): Array de IDs (SEMPRE batche múltiplos, máx: 10)

**Exemplo:**
```typescript
// No Copilot Chat:
@github Detalhes completos de #mem_1712001234567_abc123

// Tool call:
gueclaw_memory_get({
  ids: ["mem_1712001234567_abc123", "mem_1712087654321_def456"]
})

// Response:
{
  "memories": [
    {
      "id": "mem_1712001234567_abc123",
      "conversationId": "conv_telegram_8227546813_1711980000",
      "userId": "8227546813",
      "type": "decision",
      "content": "Implementar OAuth 2.0 com PKCE...",
      "context": "Após análise de vulnerabilidades CSRF...",
      "importance": "high",
      "confidence": 0.95,
      "sourceMessageIds": ["msg_123", "msg_124"],
      "tags": ["oauth", "security", "pkce"],
      "extractedAt": 1712001234567,
      "extractedAtISO": "2026-04-01T11:55:34.567Z",
      "metadata": {
        "extractedBy": "deepseek-chat",
        "references": ["https://oauth.net/2/pkce/"]
      }
    }
  ],
  "totalFetched": 1,
  "notFound": [],
  "tokensUsed": 1432
}
```

---

## 💡 EXEMPLOS DE USO

### Exemplo 1: Busca Simples

```
User: @github Busque preferências sobre TypeScript

MCP:
→ gueclaw_memory_search({ query: "TypeScript", type: "preference" })
← 3 resultados encontrados (245 tokens)

Response ao usuário:
"Encontrei 3 preferências sobre TypeScript:
1. Prefere TypeScript ao invés de JavaScript (95%)
2. Gosta de strict mode habilitado (88%)  
3. Prefere interfaces a types para objetos (82%)"
```

### Exemplo 2: Workflow Completo (Progressive Disclosure)

```
User: @github O que decidimos sobre autenticação?

Step 1 - Search:
→ gueclaw_memory_search({ query: "autenticação", type: "decision" })
← 5 decisões encontradas (412 tokens)

Step 2 - User refina:
User: @github Me mostre o contexto da decisão sobre OAuth

Step 2 - Timeline:
→ gueclaw_memory_timeline({ memoryId: "mem_...", before: 3, after: 3 })
← Timeline com 7 entradas (789 tokens)

Step 3 - User quer detalhes:
User: @github Detalhes completos dessa decisão

Step 3 - Get:
→ gueclaw_memory_get({ ids: ["mem_..."] })
← 1 memória completa (1245 tokens)

TOTAL: 2,446 tokens
vs Carregar tudo: 8,750 tokens (72% economia!)
```

### Exemplo 3: Batch Eficiente

```
User: @github Liste todas as skills do time

MCP:
→ gueclaw_memory_search({ type: "skill", limit: 20 })
← 12 skills encontradas

User: @github Detalhes das 3 mais importantes

MCP:
→ gueclaw_memory_get({ ids: ["mem_1", "mem_2", "mem_3"] })
   # Batching 3 IDs em 1 call (eficiente!)
← 3 memórias completas (3.1K tokens)
```

---

## 📊 TOKEN ECONOMICS

### Comparação: Progressive Disclosure vs Load All

**Cenário:** Usuário busca "decisões sobre OAuth" → 20 memórias matching

| Abordagem | Tokens | Custo (DeepSeek) | Economia |
|-----------|--------|------------------|----------|
| **Load All** (20 memórias completas) | 14,000 | $0.042 | - |
| **Progressive** (search + timeline + get 2) | 3,700 | $0.011 | **73.6%** |

**Breakdown Progressive:**
- Layer 1 (search 20): 1,500 tokens
- Layer 2 (timeline 1): 800 tokens
- Layer 3 (get 2): 1,400 tokens

---

## 🎯 BOAS PRÁTICAS

### ✅ DO

1. **Sempre comece com Layer 1 (search)**
   ```
   gueclaw_memory_search({ query: "..." }) → Filter → Get details
   ```

2. **Batch múltiplos IDs no get**
   ```typescript
   // ✅ BOM
   gueclaw_memory_get({ ids: ["mem_1", "mem_2", "mem_3"] })
   
   // ❌ RUIM (3 calls separadas)
   gueclaw_memory_get({ ids: ["mem_1"] })
   gueclaw_memory_get({ ids: ["mem_2"] })
   gueclaw_memory_get({ ids: ["mem_3"] })
   ```

3. **Use timeline para decisões críticas**
   - Entender contexto histórico
   - Ver dependências entre memórias

4. **Filtros específicos economizam tokens**
   ```typescript
   // ✅ Específico
   gueclaw_memory_search({ query: "OAuth", type: "decision", importance: "high" })
   
   // ⚠️  Genérico (mais results, mais tokens)
   gueclaw_memory_search({ query: "OAuth" })
   ```

### ❌ DON'T

1. **Não carregue detalhes completos sem filtrar antes**
   ```typescript
   // ❌ ANTI-PATTERN
   const allMemories = gueclaw_memory_search({ query: "" })
   const details = gueclaw_memory_get({ ids: allMemories.map(m => m.id) })
   // → Carrega tudo (perdeu o benefício do progressive disclosure)
   ```

2. **Não ignore nextSteps no response**
   - O campo `nextSteps` sugere a próxima camada ideal

3. **Não use limit muito alto no search**
   - Padrão: 10 (suficiente na maioria dos casos)
   - Máximo recomendado: 20

---

## 🐛 TROUBLESHOOTING

### Problema: MCP Server não inicia

**Sintomas:** Tools não aparecem no Copilot Chat

**Solução:**
1. Verifique que `tsx` está instalado: `npm list tsx`
2. Reload Window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check Output: `View` → `Output` → Selecione "MCP Servers"

### Problema: "Memory not found"

**Sintomas:** `timeline` ou `get` retornam "not found"

**Solução:**
1. Verifique que o ID está correto (copie do `search` response)
2. Memórias podem ter sido deletadas (expired ou manual)
3. Use `search` novamente para atualizar lista

### Problema: Tokens muito altos

**Sintomas:** `tokensUsed` > 2000 para search simples

**Solução:**
1. Reduza `limit` no search (padrão: 10)
2. Use filtros (`type`, `importance`) para reduzir results
3. Não carregue timeline/get sem necessidade

---

## 🔧 CONFIGURAÇÃO AVANÇADA

### Variáveis de Ambiente

```bash
# .env
DATABASE_PATH=./data/gueclaw.db
DATABASE_ENCRYPTION_KEY=<256-bit hex key>
NODE_ENV=production
```

### Customizar Comportamento

Para alterar limites ou defaults, edite:

**src/mcp/tools/search-tool.ts:**
```typescript
const limit = args.limit ?? 10; // Altere default limit
```

**src/mcp/tools/timeline-tool.ts:**
```typescript
const beforeCount = args.before ?? 3; // Altere default window
```

---

## 📈 MÉTRICAS E MONITORAMENTO

### Ver Statistics em Runtime

O MCP server loga stats automaticamente após cada call:

```
[MCP] Token usage stats: {
  "searchCalls": 5,
  "timelineCalls": 2,
  "getCalls": 3,
  "totalTokensUsed": 8234,
  "averageTokensPerSearch": 342,
  "averageTokensPerTimeline": 795,
  "averageTokensPerGet": 1245
}
```

### Interpretar Métricas

- **searchCalls:** Quantas buscas foram feitas
- **averageTokensPerSearch:** Se > 500, reduza `limit`
- **averageTokensPerGet:** Se > 1500, está carregando muitas memórias de uma vez

---

## 🚀 PRÓXIMAS MELHORIAS (Future Phases)

### Phase 2: Vector Search (Planejado)
- Substituir FTS por Chroma DB
- Busca semântica (não apenas keyword)
- Embeddings locais (sem custo extra)

### Phase 3: Web Viewer (Planejado)
- Dashboard em `localhost:37777`
- Real-time memory stream
- Analytics visual

### Phase 4: Auto-Hooks (Planejado)
- Captura automática de tool executions
- Smart memory pruning
- Cross-user memory (team mode)

---

## 📚 REFERÊNCIAS

- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Claude-Mem (inspiração)](https://github.com/thedotmack/claude-mem)
- [GueClaw Phase 3.2](../DOE/PHASE-3-2-ADVANCED-MEMORY-COMPLETE.md)
- [Implementation Plan](../DOE/PHASE-MCP-MEMORY-IMPLEMENTATION-PLAN.md)

---

## ✅ CHECKLIST DE VALIDAÇÃO

Antes de usar em produção, valide:

- [ ] MCP Server starta sem erros
- [ ] `gueclaw_memory_search` retorna results
- [ ] `gueclaw_memory_timeline` mostra contexto
- [ ] `gueclaw_memory_get` carrega detalhes completos
- [ ] Token usage < 500 tokens para search simples
- [ ] Progressive disclosure funciona no Copilot Chat
- [ ] Database `gueclaw.db` tem memórias (rode extração primeiro)

---

**Status:** ✅ PRONTO PARA USO  
**Versão:** 1.0.0  
**Data:** 13/04/2026  
**Mantido por:** GueClaw Team
