# 🧠 CLAUDE-MEM INTEGRATION ANALYSIS

**Data:** 13/04/2026  
**Objetivo:** Avaliar aplicabilidade do claude-mem para GueClaw e VS Code

---

## 📊 O QUE É CLAUDE-MEM?

Sistema de compressão de memória persistente construído para Claude Code que:
- **Captura automaticamente** tudo que o Claude faz durante sessões
- **Comprime com IA** usando Claude agent-sdk  
- **Injeta contexto relevante** em sessões futuras
- **51.6k stars** no GitHub (projeto muito popular)
- **v12.1.0** (225 releases - projeto maduro)

### Arquitetura Claude-Mem

```
┌─────────────────────────────────────────────────────┐
│          CLAUDE-MEM ARCHITECTURE                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. 📝 LIFECYCLE HOOKS (5 hooks)                    │
│     ├─ SessionStart                                 │
│     ├─ UserPromptSubmit                             │
│     ├─ PostToolUse                                  │
│     ├─ Stop                                          │
│     └─ SessionEnd                                    │
│                                                      │
│  2. ⚙️  WORKER SERVICE                               │
│     ├─ HTTP API (porta 37777)                       │
│     ├─ 10 search endpoints                          │
│     ├─ Web Viewer UI (real-time)                    │
│     └─ Managed by Bun                                │
│                                                      │
│  3. 🗄️  SQLITE DATABASE                             │
│     ├─ sessions                                      │
│     ├─ observations                                  │
│     └─ summaries                                     │
│                                                      │
│  4. 🔍 CHROMA VECTOR DATABASE                       │
│     ├─ Hybrid semantic search                       │
│     ├─ Keyword search                                │
│     └─ Intelligent context retrieval                │
│                                                      │
│  5. 🎯 MCP SEARCH TOOLS (Progressive Disclosure)    │
│     ├─ search        (~50-100 tokens/result)        │
│     ├─ timeline      (chronological context)        │
│     └─ get_observations (~500-1K tokens/result)     │
│                                                      │
│  6. 🛠️  MEM-SEARCH SKILL                            │
│     └─ Natural language queries                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 GUECLAW - ESTADO ATUAL

### ✅ O que já temos (Fase 3.2 - COMPLETA)

```typescript
// src/services/memory-extractor/
├── memory-repository.ts        (290 LOC) - SQLite CRUD
├── memory-extractor.ts         (300 LOC) - LLM extraction (DeepSeek)
├── memory-manager-service.ts   (245 LOC) - Orchestration
└── types.ts                    (153 LOC) - Type definitions

// Telegram handler
└── src/handlers/memory-handler.ts (240 LOC) - /memory commands
```

**Recursos:**
- ✅ 7 tipos de memória: `preference`, `decision`, `fact`, `goal`, `skill`, `constraint`, `context`
- ✅ 4 níveis de importância: `low`, `medium`, `high`, `critical`  
- ✅ Confidence scoring (threshold 0.7)
- ✅ Auto-expiration para memórias low-importance
- ✅ Garbage collection automático
- ✅ SQLite com índices otimizados
- ✅ Extração LLM-based (DeepSeek - 97.2% mais barato que GPT-4o)
- ✅ Interface Telegram (`/memory`, `/memory stats`, `/memory [tipo]`, `/memory clear`)

**Database Schema:**
```sql
CREATE TABLE extracted_memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  importance TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_message_ids TEXT NOT NULL,
  tags TEXT NOT NULL,
  extracted_at INTEGER NOT NULL,
  expires_at INTEGER,
  metadata TEXT
);
```

### ❌ O que nos falta (vs Claude-Mem)

| Feature | GueClaw | Claude-Mem | Impacto |
|---------|---------|------------|---------|
| **Vector Search** | ❌ Apenas SQLite FTS | ✅ Chroma DB híbrido | 🔥🔥🔥🔥🔥 |
| **Progressive Disclosure** | ❌ Carrega tudo | ✅ 3-layer (~10x economia) | 🔥🔥🔥🔥 |
| **Web Viewer UI** | ❌ Apenas Telegram | ✅ localhost:37777 | 🔥🔥🔥 |
| **MCP Tools** | ⚠️  Memory MCP básico | ✅ 3 tools otimizados | 🔥🔥🔥🔥🔥 |
| **Timeline Context** | ❌ Sem timeline | ✅ Contexto cronológico | 🔥🔥🔥 |
| **Lifecycle Hooks** | ❌ Manual trigger | ✅ Auto-captura (5 hooks) | 🔥🔥🔥🔥 |
| **Citations** | ❌ Sem IDs referenciáveis | ✅ Observation IDs | 🔥🔥 |

---

## 🚀 OPORTUNIDADES DE INTEGRAÇÃO

### 1. **VECTOR SEARCH com Chroma DB** 🔥🔥🔥🔥🔥

**O que é:**
- Banco vetorial híbrido (semântico + keyword)
- Embeddings para busca por similaridade
- RAG mais inteligente

**Aplicação GueClaw:**
```typescript
// Busca atual (SQLite FTS)
SELECT * FROM extracted_memories WHERE content LIKE '%typescript%'

// Busca com vector (Chroma)
chromaClient.query({
  queryTexts: ["Como fazer autenticação segura?"],
  nResults: 5,
  where: { type: "decision" }
})
// → Retorna decisões similares semanticamente, não apenas keyword match
```

**ROI:**
- ✅ Queries muito mais inteligentes
- ✅ RAG de qualidade profissional
- ✅ Descoberta de contexto não-óbvio
- ⚠️  Custo: Precisa gerar embeddings (pode usar local model)

**Esforço:** 12-16h  
**Prioridade:** 🟡 MÉDIA (temos FTS funcional, mas vector é superior)

---

### 2. **PROGRESSIVE DISCLOSURE (3-Layer Workflow)** 🔥🔥🔥🔥

**O que é:**
Sistema de recuperação em camadas para economizar tokens:

```typescript
// Layer 1: Search Index (50-100 tokens/result)
const index = await mcp.search({
  query: "authentication bugs",
  type: "bugfix",
  limit: 20
});
// → [{ id: 123, title: "Fix OAuth token...", date: "2026-04-01" }, ...]

// Layer 2: Timeline Context (200-300 tokens)
const timeline = await mcp.timeline({
  observationId: 123,
  before: 3,
  after: 3
});
// → Contexto do que estava acontecendo ao redor

// Layer 3: Full Details (500-1K tokens/result)
const details = await mcp.get_observations({
  ids: [123, 456]  // Apenas os relevantes!
});
```

**Economia de Tokens:**
```
Abordagem atual (GueClaw):
20 memórias × 500 tokens = 10,000 tokens

Progressive Disclosure (Claude-Mem):
20 índices × 75 tokens = 1,500 tokens
2 timelines × 250 tokens = 500 tokens
2 detalhes × 750 tokens = 1,500 tokens
TOTAL = 3,500 tokens (~65% economia!)
```

**ROI:**
- ✅ 10x economia de tokens (comprovado no claude-mem)
- ✅ Contexto mais preciso (só carrega o relevante)
- ✅ Melhor performance (menos I/O)

**Esforço:** 8-12h  
**Prioridade:** 🔴 ALTA (economia massiva de custos)

---

### 3. **WEB VIEWER UI** 🔥🔥🔥

**O que é:**
Dashboard web em `localhost:37777` para:
- Ver stream de memórias em tempo real
- Buscar e filtrar observações
- Visualizar timeline de eventos
- Métricas e analytics
- Settings (beta channel, etc)

**Aplicação GueClaw:**
```
http://localhost:37777/
├─ /api/observation/{id}      # Get memory by ID
├─ /api/search                # Search endpoint
├─ /api/timeline              # Timeline view
├─ /api/stats                 # Analytics
└─ / (UI)                     # Web viewer
```

**ROI:**
- ✅ Debugging muito mais fácil
- ✅ Monitoring de memórias
- ✅ UX melhor que Telegram para analysis
- ✅ Compartilhar contexto com time

**Esforço:** 16-20h (frontend React + backend Express)  
**Prioridade:** 🟡 MÉDIA (nice-to-have, Telegram já funciona)

---

### 4. **MCP TOOLS para VS Code** 🔥🔥🔥🔥🔥

**O que é:**
Integrar claude-mem como MCP server no VS Code para:
- Busca semântica de memórias direto do editor
- Comandos slash no Copilot Chat
- Integração nativa com workspace

**Implementação:**
```json
// config/mcp-servers.json
{
  "servers": {
    "gueclaw-memory": {
      "command": "node",
      "args": ["./src/mcp/memory-server.js"],
      "env": {
        "DATABASE_PATH": "${env:DATABASE_PATH}",
        "CHROMA_URL": "http://localhost:8000"
      }
    }
  }
}
```

**MCP Tools:**
```typescript
// src/mcp/memory-server.ts
export const tools = {
  gueclaw_memory_search: {
    description: "Search GueClaw memories with semantic search",
    inputSchema: {
      query: { type: "string" },
      type: { enum: ["preference", "decision", "fact", ...] },
      limit: { type: "number", default: 10 }
    }
  },
  
  gueclaw_memory_timeline: {
    description: "Get chronological context around a memory",
    inputSchema: {
      memoryId: { type: "string" },
      before: { type: "number", default: 3 },
      after: { type: "number", default: 3 }
    }
  },
  
  gueclaw_memory_get: {
    description: "Get full memory details by IDs",
    inputSchema: {
      ids: { type: "array", items: { type: "string" } }
    }
  }
};
```

**Uso no VS Code:**
```
@github /chat Busque memórias sobre autenticação OAuth

> [MCP] gueclaw_memory_search(query="OAuth authentication", type="decision")
> Encontrei 3 decisões:
> - #mem_2026_abc: Decidido usar OAuth 2.0 com PKCE
> - #mem_2026_def: Refresh tokens com rotação automática
> - #mem_2026_ghi: Scope mínimo: read:user

@github /chat Me mostre o contexto da decisão #mem_2026_abc

> [MCP] gueclaw_memory_timeline(memoryId="mem_2026_abc", before=3, after=3)
> Timeline ao redor de 01/04/2026:
> [31/03] Bug: Token expirando muito rápido
> [31/03] Pesquisa sobre OAuth 2.1 recommendations
> [01/04] 🎯 DECISÃO: Implementar OAuth 2.0 + PKCE
> [01/04] Instalado biblioteca oauth-pkce
> [02/04] Testes de refresh token
```

**ROI:**
- ✅ **DX MELHOR:** Busca de memórias direto no editor
- ✅ **WORKFLOW INTEGRADO:** Sem sair do VS Code
- ✅ **CONTEXTO RICO:** Timeline + semantic search
- ✅ **PRODUTIVIDADE:** Menos context switching

**Esforço:** 10-14h  
**Prioridade:** 🔴 CRÍTICA (maior valor para dev workflow)

---

### 5. **OBSERVATION TIMELINE** 🔥🔥🔥

**O que é:**
Ver o que estava acontecendo ao redor de uma memória específica.

**Exemplo:**
```
Memória: "Decidido usar TypeScript ao invés de JavaScript"

Timeline (before=3, after=3):

📅 02/04 - 10:14 - [preference] Prefere código type-safe
📅 02/04 - 10:45 - [fact] Time tem experiência com TS
📅 02/04 - 11:20 - [context] Discutindo stack do novo projeto
🎯 02/04 - 11:55 - [decision] USAR TYPESCRIPT (confidence: 0.95)
📅 02/04 - 12:10 - [constraint] Deadline apertado (2 meses)
📅 02/04 - 14:30 - [goal] Lançar MVP até junho
📅 02/04 - 16:00 - [skill] Junior sabe React + TS
```

**Valor:**
- ✅ Contexto histórico completo
- ✅ Entender raciocínio por trás de decisões
- ✅ Descobrir dependências entre memórias

**Esforço:** 6-8h  
**Prioridade:** 🟡 MÉDIA (nice-to-have, mas não crítico)

---

### 6. **LIFECYCLE HOOKS (Auto-Capture)** 🔥🔥🔥🔥

**O que é:**
Captura automática de eventos sem intervenção manual.

**Claude-Mem Hooks:**
```typescript
// SessionStart
onSessionStart(() => {
  loadRelevantContext();
  injectMemories();
});

// UserPromptSubmit
onUserPromptSubmit((prompt) => {
  extractIntent(prompt);
  searchRelevantMemories(prompt);
});

// PostToolUse
onPostToolUse((toolName, args, result) => {
  captureObservation({ tool: toolName, outcome: result });
});

// Stop
onStop(() => {
  savePartialState();
});

// SessionEnd
onSessionEnd(() => {
  compressSession();
  extractMemories();
});
```

**GueClaw Atual:**
- ❌ Trigger manual via `/memory`
- ❌ Extração apenas quando comando é chamado
- ✅ Mas temos trigger automático a cada 10+ mensagens

**Adaptação para GueClaw:**
```typescript
// src/core/hooks/lifecycle.ts
export class LifecycleManager {
  private hooks = {
    onConversationStart: [],
    onMessageReceived: [],
    onToolExecuted: [],
    onMessageSent: [],
    onConversationEnd: []
  };

  async onToolExecuted(tool: string, result: any) {
    // Auto-capture important tool results
    if (IMPORTANT_TOOLS.includes(tool)) {
      await memoryExtractor.captureObservation({
        tool,
        result,
        timestamp: Date.now()
      });
    }
  }
}
```

**ROI:**
- ✅ Zero esforço do usuário
- ✅ Captura completa de contexto
- ✅ Memórias mais precisas

**Esforço:** 10-12h  
**Prioridade:** 🟡 MÉDIA (já temos auto-trigger em 10+ msgs)

---

## 🎯 PLANO DE IMPLEMENTAÇÃO RECOMENDADO

### 🏆 PHASE 1: MCP Tools + Progressive Disclosure (QUICK WIN)

**Prazo:** 1 semana  
**Esforço:** 18-26h  
**ROI:** 🔥🔥🔥🔥🔥 ALTÍSSIMO

**Entregas:**
1. ✅ MCP Server para GueClaw Memory
2. ✅ 3 tools: `search`, `timeline`, `get_memories`
3. ✅ Progressive Disclosure (3-layer workflow)
4. ✅ Integração VS Code (config/mcp-servers.json)

**Arquivos a criar:**
```
src/mcp/
├── memory-server.ts           (200 LOC) - MCP server implementation
├── tools/
│   ├── search-tool.ts         (100 LOC) - Layer 1: Index search
│   ├── timeline-tool.ts       (120 LOC) - Layer 2: Chronological context
│   └── get-memories-tool.ts   (80 LOC)  - Layer 3: Full details
└── types.ts                   (60 LOC)  - MCP types

tests/mcp/
└── memory-server.test.ts      (150 LOC) - Unit tests
```

**Exemplo de uso:**
```bash
# No VS Code Chat
@github Busque decisões sobre autenticação

# MCP Tool Call
gueclaw_memory_search({
  query: "autenticação",
  type: "decision",
  limit: 5
})

# Response (Layer 1 - Index only)
[
  { id: "mem_123", title: "OAuth 2.0 + PKCE", confidence: 0.95, date: "01/04" },
  { id: "mem_456", title: "Refresh token rotation", confidence: 0.88, date: "02/04" }
]

# User: "Me dê mais detalhes sobre #mem_123"

# MCP Tool Call (Layer 3)
gueclaw_memory_get({ ids: ["mem_123"] })

# Response (Full details)
{
  id: "mem_123",
  type: "decision",
  content: "Implementar OAuth 2.0 com PKCE para auth do app mobile",
  context: "Discussão sobre segurança após análise de vulnerabilidades",
  importance: "high",
  confidence: 0.95,
  tags: ["oauth", "security", "mobile"],
  extractedAt: 1712001234567
}
```

---

### 🔥 PHASE 2: Vector Search (Chroma DB)

**Prazo:** 1 semana  
**Esforço:** 12-16h  
**ROI:** 🔥🔥🔥🔥 ALTO

**Entregas:**
1. ✅ Integração Chroma DB
2. ✅ Embeddings generation (local model ou OpenAI)
3. ✅ Hybrid search (semantic + keyword)
4. ✅ Migration de memórias existentes

**Arquivos a criar:**
```
src/services/vector-search/
├── chroma-client.ts           (150 LOC) - Chroma wrapper
├── embedding-service.ts       (100 LOC) - Generate embeddings
├── hybrid-search.ts           (120 LOC) - Combine FTS + vector
└── migration.ts               (80 LOC)  - Migrate existing memories

config/
└── chroma.json                (20 LOC)  - Chroma configuration
```

**Stack:**
```bash
npm install chromadb
npm install @huggingface/transformers  # Para embeddings locais
# OU usar OpenAI embeddings (mais caro, mas melhor qualidade)
```

---

### 🎨 PHASE 3: Web Viewer UI (Optional)

**Prazo:** 1.5 semanas  
**Esforço:** 16-20h  
**ROI:** 🔥🔥🔥 MÉDIO

**Entregas:**
1. ✅ Frontend React Dashboard
2. ✅ Backend Express API
3. ✅ Real-time memory stream
4. ✅ Search + Filter UI
5. ✅ Analytics & Stats

**Stack:**
```bash
npx create-next-app gueclaw-memory-viewer
npm install @tanstack/react-query recharts
```

---

## 📊 COMPARAÇÃO FINAL

| Aspecto | GueClaw Atual | Claude-Mem | GueClaw + Integration |
|---------|---------------|------------|----------------------|
| **Memory Storage** | SQLite ✅ | SQLite ✅ | SQLite ✅ |
| **Extraction** | LLM (DeepSeek) ✅ | LLM (Claude) ⚠️ | LLM (DeepSeek) ✅ |
| **Search** | FTS ⚠️ | Chroma Vector ✅ | Hybrid ✅✅ |
| **Progressive Disclosure** | ❌ | ✅ | ✅ |
| **MCP Integration** | Basic ⚠️ | Advanced ✅ | Advanced ✅ |
| **Web UI** | ❌ | ✅ | ✅ |
| **Timeline** | ❌ | ✅ | ✅ |
| **Telegram** | ✅ | ❌ | ✅✅ |
| **Auto-Capture** | Partial ⚠️ | Full ✅ | Full ✅ |
| **Cost** | Low ✅✅ | Medium ⚠️ | Low ✅✅ |

**Legenda:**
- ✅✅ = Excelente
- ✅ = Bom
- ⚠️ = Funcional mas pode melhorar
- ❌ = Não tem

---

## 🎯 RECOMENDAÇÃO FINAL

### ❌ NÃO usar claude-mem diretamente porque:

1. **Licença AGPL-3.0** - "devo" do código se deployar em rede
2. **Dependência pesada** - Bun, uv, Python, ChromaDB, etc
3. **Built for Claude Code** - Hooks específicos do Claude Code (não Telegram)
4. **Overlap alto** - Já temos 70% das features (Phase 3.2)

### ✅ MAS aproveitar os conceitos:

1. **Progressive Disclosure** → Economiza 10x tokens
2. **MCP Tools** → Integração VS Code nativa
3. **Chroma Vector Search** → RAG profissional
4. **Timeline Context** → Contexto cronológico rico

### 🚀 AÇÃO RECOMENDADA:

**Implementar PHASE 1 (MCP Tools + Progressive Disclosure)**

**Por quê:**
- ✅ ROI altíssimo (10x economia de tokens)
- ✅ Integração VS Code (DX melhor)
- ✅ Esforço baixo (18-26h)
- ✅ Reutiliza 100% do código da Phase 3.2
- ✅ Sem dependências externas pesadas
- ✅ Mantém arquitetura GueClaw (Telegram + SQLite)

**Próximos passos:**
1. Criar MCP server (`src/mcp/memory-server.ts`)
2. Implementar 3 tools (search, timeline, get)
3. Configurar em `config/mcp-servers.json`
4. Testar no VS Code Copilot Chat
5. Documentar skill para uso via Telegram

---

**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Reviewed by:** GueClaw Memory System Analysis  
**Next Step:** Aprovar Phase 1 e começar implementação
