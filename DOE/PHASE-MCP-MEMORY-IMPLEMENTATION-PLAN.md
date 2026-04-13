# 🧠 PHASE MCP: MCP Memory Tools + Progressive Disclosure

**Prioridade:** 🔴 CRÍTICA  
**Esforço:** 18-26h  
**ROI:** 🔥🔥🔥🔥🔥 ALTÍSSIMO (10x economia de tokens + VS Code integration)  
**Data Início:** 13/04/2026  
**Deadline:** 20/04/2026 (1 semana)

---

## 🎯 OBJETIVOS

Implementar sistema de memória baseado em MCP (Model Context Protocol) inspirado no claude-mem, com Progressive Disclosure para integração nativa com VS Code Copilot Chat.

### Entregas

1. ✅ MCP Server para GueClaw Memory
2. ✅ 3 MCP Tools: `search`, `timeline`, `get_memories`
3. ✅ Progressive Disclosure (3-layer workflow)
4. ✅ Integração VS Code (config/mcp-servers.json)
5. ✅ Skill documentation + examples
6. ✅ Unit tests (>80% coverage)

### Não-Escopo (Phases Futuras)

- ❌ Vector Search (Chroma DB) → Phase 2
- ❌ Web Viewer UI → Phase 3
- ❌ Full Lifecycle Hooks → Phase 4
- ❌ Migration de código do claude-mem (usaremos conceitos, não código)

---

## 🏗️ ARQUITETURA

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS CODE COPILOT CHAT                      │
│  @github Busque decisões sobre OAuth                         │
└────────────────────────────┬────────────────────────────────┘
                             │ MCP Protocol
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP SERVER (GueClaw Memory)                     │
│  Port: stdio (process communication)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔍 Tool: gueclaw_memory_search                             │
│      → Layer 1: Index Search (~50-100 tokens/result)        │
│      → Returns: [{ id, title, type, date, confidence }]     │
│                                                              │
│  📅 Tool: gueclaw_memory_timeline                           │
│      → Layer 2: Chronological Context (~200-300 tokens)     │
│      → Returns: Timeline ao redor de uma memory             │
│                                                              │
│  📋 Tool: gueclaw_memory_get                                │
│      → Layer 3: Full Details (~500-1K tokens/result)        │
│      → Returns: Memória completa com context                │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          GUECLAW MEMORY SYSTEM (Existing)                    │
│  MemoryRepository + MemoryManagerService                     │
│  SQLite: extracted_memories table                            │
└─────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure Workflow

```typescript
// EXEMPLO DE USO NO VS CODE CHAT

// ========================================
// USER PROMPT
// ========================================
@github Busque decisões sobre autenticação OAuth

// ========================================
// LAYER 1: INDEX SEARCH (Low Token Cost)
// ========================================
[MCP Tool Call]
gueclaw_memory_search({
  query: "autenticação OAuth",
  type: "decision",
  limit: 5
})

[Tool Response - 350 tokens]
{
  results: [
    {
      id: "mem_1712001234567_abc123",
      title: "Implementar OAuth 2.0 + PKCE",
      type: "decision",
      importance: "high",
      confidence: 0.95,
      date: "2026-04-01T11:55:00Z",
      tags: ["oauth", "security", "mobile"]
    },
    {
      id: "mem_1712087654321_def456",
      title: "Refresh token com rotação automática",
      type: "decision",
      importance: "high",
      confidence: 0.88,
      date: "2026-04-02T14:30:00Z",
      tags: ["oauth", "tokens", "security"]
    },
    {
      id: "mem_1712123456789_ghi789",
      title: "Scope mínimo: read:user + read:email",
      type: "constraint",
      importance: "medium",
      confidence: 0.82,
      date: "2026-04-03T09:15:00Z",
      tags: ["oauth", "privacy", "scope"]
    }
  ],
  totalResults: 3,
  tokensUsed: 350
}

// ========================================
// USER: "Me dê contexto sobre #mem_1712001234567_abc123"
// ========================================

// LAYER 2: TIMELINE CONTEXT (Medium Token Cost)
[MCP Tool Call]
gueclaw_memory_timeline({
  memoryId: "mem_1712001234567_abc123",
  before: 3,
  after: 3
})

[Tool Response - 800 tokens]
{
  timeline: [
    {
      id: "mem_..._xyz1",
      date: "2026-03-31T10:14:00Z",
      type: "preference",
      content: "Prefere soluções type-safe e bem documentadas",
      relativePosition: -3
    },
    {
      id: "mem_..._xyz2",
      date: "2026-03-31T15:45:00Z",
      type: "fact",
      content: "App mobile precisa de autenticação segura",
      relativePosition: -2
    },
    {
      id: "mem_..._xyz3",
      date: "2026-04-01T09:20:00Z",
      type: "context",
      content: "Análise de vulnerabilidades mostrou CSRF risks",
      relativePosition: -1
    },
    // ⭐ TARGET MEMORY
    {
      id: "mem_1712001234567_abc123",
      date: "2026-04-01T11:55:00Z",
      type: "decision",
      content: "DECIDIDO: Implementar OAuth 2.0 + PKCE",
      importance: "high",
      confidence: 0.95,
      relativePosition: 0,
      isTarget: true
    },
    {
      id: "mem_..._xyz4",
      date: "2026-04-01T12:10:00Z",
      type: "constraint",
      content: "Deadline do MVP: 2 meses",
      relativePosition: 1
    },
    {
      id: "mem_..._xyz5",
      date: "2026-04-01T14:30:00Z",
      type: "skill",
      content: "Dev Junior conhece OAuth libraries",
      relativePosition: 2
    },
    {
      id: "mem_..._xyz6",
      date: "2026-04-02T09:00:00Z",
      type: "goal",
      content: "Implementar auth flow até 15/04",
      relativePosition: 3
    }
  ],
  centerMemory: { /* full details */ },
  tokensUsed: 800
}

// ========================================
// USER: "Me dê todos os detalhes sobre OAuth"
// ========================================

// LAYER 3: FULL DETAILS (High Token Cost)
[MCP Tool Call]
gueclaw_memory_get({
  ids: [
    "mem_1712001234567_abc123",
    "mem_1712087654321_def456"
  ]
})

[Tool Response - 1400 tokens]
{
  memories: [
    {
      id: "mem_1712001234567_abc123",
      conversationId: "conv_telegram_8227546813_1711980000",
      userId: "8227546813",
      type: "decision",
      content: "Implementar OAuth 2.0 com PKCE (Proof Key for Code Exchange) para autenticação do app mobile",
      context: "Após análise de vulnerabilidades CSRF e discussão sobre segurança do fluxo de autorização. PKCE elimina risco de interceptação do authorization code em apps públicos (sem client secret).",
      importance: "high",
      confidence: 0.95,
      sourceMessageIds: ["msg_123", "msg_124", "msg_125"],
      tags: ["oauth", "security", "mobile", "pkce", "authorization"],
      extractedAt: 1712001234567,
      expiresAt: null,
      metadata: {
        extractedBy: "deepseek-chat",
        relatedDecisions: ["mem_1712087654321_def456"],
        references: [
          "https://oauth.net/2/pkce/",
          "RFC 7636"
        ]
      }
    },
    {
      id: "mem_1712087654321_def456",
      conversationId: "conv_telegram_8227546813_1711980000",
      userId: "8227546813",
      type: "decision",
      content: "Implementar refresh token rotation automática conforme OAuth 2.1 best practices",
      context: "Para aumentar segurança: refresh tokens são single-use. Cada refresh gera novo par (access + refresh). Se refresh antiga for reutilizada, revoga toda a família de tokens (detecta vazamento).",
      importance: "high",
      confidence: 0.88,
      sourceMessageIds: ["msg_145", "msg_146"],
      tags: ["oauth", "tokens", "security", "rotation", "oauth2.1"],
      extractedAt: 1712087654321,
      expiresAt: null,
      metadata: {
        extractedBy: "deepseek-chat",
        relatedDecisions: ["mem_1712001234567_abc123"],
        references: [
          "https://oauth.net/2.1/",
          "https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics"
        ]
      }
    }
  ],
  tokensUsed: 1400
}
```

### Token Economics

```
┌───────────────────────────────────────────────────────────┐
│           PROGRESSIVE DISCLOSURE SAVINGS                  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Scenario: User busca "OAuth decisions"                  │
│            20 memórias no DB matching                     │
│                                                           │
│  ❌ ABORDAGEM TRADICIONAL (Load All):                    │
│     20 memories × 700 tokens avg = 14,000 tokens         │
│     💸 Custo: $0.042 (DeepSeek output)                   │
│                                                           │
│  ✅ PROGRESSIVE DISCLOSURE:                              │
│     Layer 1: 20 × 75 tokens   =  1,500 tokens (index)    │
│     Layer 2:  1 × 800 tokens  =    800 tokens (timeline) │
│     Layer 3:  2 × 700 tokens  =  1,400 tokens (details)  │
│     ─────────────────────────────────────────────────     │
│     TOTAL:                       3,700 tokens            │
│     💸 Custo: $0.011 (DeepSeek output)                   │
│                                                           │
│  📊 ECONOMIA: 73.6% (~3.8x menos tokens)                 │
│     ROI: Paga desenvolvimento em ~1 mês de uso           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 📂 ESTRUTURA DE ARQUIVOS

```
src/mcp/
├── memory-server.ts                (280 LOC) ⭐ MCP server main
├── types.ts                        ( 80 LOC) - MCP protocol types
├── tools/
│   ├── search-tool.ts              (150 LOC) ⭐ Layer 1: Index
│   ├── timeline-tool.ts            (180 LOC) ⭐ Layer 2: Context
│   └── get-memories-tool.ts        (120 LOC) ⭐ Layer 3: Details
└── utils/
    ├── formatter.ts                ( 90 LOC) - Response formatters
    └── token-counter.ts            ( 60 LOC) - Token usage tracking

config/
└── mcp-servers.json                (Updated) - Add gueclaw-memory server

tests/mcp/
├── memory-server.test.ts           (180 LOC) - Server tests
├── search-tool.test.ts             ( 90 LOC) - Search tests
├── timeline-tool.test.ts           (100 LOC) - Timeline tests
└── get-memories-tool.test.ts       ( 70 LOC) - Get tests

docs/
└── mcp-memory-usage.md             (300 LOC) - Usage guide + examples

Total: ~1,400 LOC (net new code)
```

---

## 🛠️ IMPLEMENTAÇÃO DETALHADA

### 1. MCP Server Core (memory-server.ts)

```typescript
/**
 * GueClaw Memory MCP Server
 * 
 * Provides 3 progressive disclosure tools for memory search:
 * 1. gueclaw_memory_search    - Layer 1: Index search (low tokens)
 * 2. gueclaw_memory_timeline  - Layer 2: Context timeline (medium tokens)
 * 3. gueclaw_memory_get       - Layer 3: Full details (high tokens)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MemoryManagerService } from '../services/memory-extractor';
import { searchTool } from './tools/search-tool';
import { timelineTool } from './tools/timeline-tool';
import { getMemoriesTool } from './tools/get-memories-tool';

// Initialize MCP server
const server = new Server(
  {
    name: 'gueclaw-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  {
    name: 'gueclaw_memory_search',
    description: 'Search GueClaw memory index (Layer 1: ~50-100 tokens/result). Returns compact summaries with IDs for filtering before fetching full details.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query or keywords',
        },
        type: {
          type: 'string',
          enum: ['preference', 'decision', 'fact', 'goal', 'skill', 'constraint', 'context'],
          description: 'Filter by memory type (optional)',
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by importance level (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
          default: 10,
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence score 0-1 (default: 0.7)',
          default: 0.7,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'gueclaw_memory_timeline',
    description: 'Get chronological context around a specific memory (Layer 2: ~200-300 tokens). Shows what was happening before/after for better understanding.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'Memory ID from search results',
        },
        before: {
          type: 'number',
          description: 'Number of memories before target (default: 3)',
          default: 3,
        },
        after: {
          type: 'number',
          description: 'Number of memories after target (default: 3)',
          default: 3,
        },
      },
      required: ['memoryId'],
    },
  },
  {
    name: 'gueclaw_memory_get',
    description: 'Get full memory details by IDs (Layer 3: ~500-1K tokens/result). Use after filtering with search. ALWAYS batch multiple IDs in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of memory IDs to fetch (batch multiple for efficiency)',
        },
      },
      required: ['ids'],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'gueclaw_memory_search':
        return await searchTool(args);

      case 'gueclaw_memory_timeline':
        return await timelineTool(args);

      case 'gueclaw_memory_get':
        return await getMemoriesTool(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GueClaw Memory MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### 2. Search Tool (Layer 1)

```typescript
// src/mcp/tools/search-tool.ts

import { MemoryManagerService } from '../../services/memory-extractor';
import { MemoryType, MemoryImportance } from '../../services/memory-extractor/types';
import { formatSearchResults } from '../utils/formatter';
import { countTokens } from '../utils/token-counter';

interface SearchArgs {
  query: string;
  type?: MemoryType;
  importance?: MemoryImportance;
  limit?: number;
  minConfidence?: number;
}

export async function searchTool(args: SearchArgs) {
  const memoryManager = MemoryManagerService.getInstance();

  // TODO: Implement semantic search (Phase 2: Vector DB)
  // For now, use SQLite FTS + basic filtering

  // Get memories from repository
  const memories = memoryManager.repository.query({
    userId: 'all', // TODO: Get from context
    types: args.type ? [args.type] : undefined,
    importance: args.importance ? [args.importance] : undefined,
    minConfidence: args.minConfidence ?? 0.7,
    limit: args.limit ?? 10,
  });

  // Filter by query (simple text match for now)
  const filtered = memories.filter((m) => {
    const searchText = `${m.content} ${m.context || ''} ${m.tags.join(' ')}`.toLowerCase();
    const queryLower = args.query.toLowerCase();
    return searchText.includes(queryLower);
  });

  // Format as compact index
  const results = filtered.map((m) => ({
    id: m.id,
    title: m.content.substring(0, 80) + (m.content.length > 80 ? '...' : ''),
    type: m.type,
    importance: m.importance,
    confidence: m.confidence,
    date: new Date(m.extractedAt).toISOString(),
    tags: m.tags.slice(0, 5), // Limit tags for token efficiency
  }));

  const response = formatSearchResults(results, args.query);
  const tokens = countTokens(JSON.stringify(response));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            results,
            totalResults: results.length,
            query: args.query,
            filters: {
              type: args.type,
              importance: args.importance,
              minConfidence: args.minConfidence,
            },
            tokensUsed: tokens,
            nextSteps: [
              'Use gueclaw_memory_timeline(memoryId) to see context around interesting results',
              'Use gueclaw_memory_get(ids: [...]) to fetch full details (batch multiple IDs)',
            ],
          },
          null,
          2
        ),
      },
    ],
  };
}
```

### 3. Timeline Tool (Layer 2)

```typescript
// src/mcp/tools/timeline-tool.ts

import { MemoryManagerService } from '../../services/memory-extractor';
import { countTokens } from '../utils/token-counter';

interface TimelineArgs {
  memoryId: string;
  before?: number;
  after?: number;
}

export async function timelineTool(args: TimelineArgs) {
  const memoryManager = MemoryManagerService.getInstance();

  // Get target memory
  const targetMemory = memoryManager.repository.query({
    userId: 'all',
  }).find((m) => m.id === args.memoryId);

  if (!targetMemory) {
    throw new Error(`Memory not found: ${args.memoryId}`);
  }

  // Get all memories from same conversation
  const allMemories = memoryManager.repository
    .getByConversation(targetMemory.conversationId)
    .sort((a, b) => a.extractedAt - b.extractedAt);

  // Find target index
  const targetIndex = allMemories.findIndex((m) => m.id === args.memoryId);

  // Get before/after windows
  const beforeCount = args.before ?? 3;
  const afterCount = args.after ?? 3;

  const beforeMemories = allMemories.slice(
    Math.max(0, targetIndex - beforeCount),
    targetIndex
  );

  const afterMemories = allMemories.slice(
    targetIndex + 1,
    Math.min(allMemories.length, targetIndex + 1 + afterCount)
  );

  // Build timeline
  const timeline = [
    ...beforeMemories.map((m, i) => ({
      id: m.id,
      date: new Date(m.extractedAt).toISOString(),
      type: m.type,
      content: m.content,
      importance: m.importance,
      relativePosition: -(beforeCount - i),
    })),
    {
      id: targetMemory.id,
      date: new Date(targetMemory.extractedAt).toISOString(),
      type: targetMemory.type,
      content: targetMemory.content,
      context: targetMemory.context,
      importance: targetMemory.importance,
      confidence: targetMemory.confidence,
      tags: targetMemory.tags,
      relativePosition: 0,
      isTarget: true,
    },
    ...afterMemories.map((m, i) => ({
      id: m.id,
      date: new Date(m.extractedAt).toISOString(),
      type: m.type,
      content: m.content,
      importance: m.importance,
      relativePosition: i + 1,
    })),
  ];

  const response = {
    timeline,
    centerMemory: {
      id: targetMemory.id,
      content: targetMemory.content,
      context: targetMemory.context,
      type: targetMemory.type,
      importance: targetMemory.importance,
      confidence: targetMemory.confidence,
    },
    conversationId: targetMemory.conversationId,
    windowSize: {
      before: beforeMemories.length,
      after: afterMemories.length,
    },
  };

  const tokens = countTokens(JSON.stringify(response));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...response,
            tokensUsed: tokens,
            nextSteps: [
              'Use gueclaw_memory_get(ids) to fetch full details of interesting timeline entries',
            ],
          },
          null,
          2
        ),
      },
    ],
  };
}
```

### 4. Get Memories Tool (Layer 3)

```typescript
// src/mcp/tools/get-memories-tool.ts

import { MemoryManagerService } from '../../services/memory-extractor';
import { countTokens } from '../utils/token-counter';

interface GetMemoriesArgs {
  ids: string[];
}

export async function getMemoriesTool(args: GetMemoriesArgs) {
  const memoryManager = MemoryManagerService.getInstance();

  if (!args.ids || args.ids.length === 0) {
    throw new Error('At least one memory ID is required');
  }

  // Get all memories
  const allMemories = memoryManager.repository.query({
    userId: 'all',
  });

  // Filter by IDs
  const memories = allMemories.filter((m) => args.ids.includes(m.id));

  if (memories.length === 0) {
    throw new Error(`No memories found for IDs: ${args.ids.join(', ')}`);
  }

  // Return full details
  const response = {
    memories: memories.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      userId: m.userId,
      type: m.type,
      content: m.content,
      context: m.context,
      importance: m.importance,
      confidence: m.confidence,
      sourceMessageIds: m.sourceMessageIds,
      tags: m.tags,
      extractedAt: m.extractedAt,
      extractedAtISO: new Date(m.extractedAt).toISOString(),
      expiresAt: m.expiresAt,
      metadata: m.metadata,
    })),
    totalFetched: memories.length,
    notFound: args.ids.filter((id) => !memories.find((m) => m.id === id)),
  };

  const tokens = countTokens(JSON.stringify(response));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...response,
            tokensUsed: tokens,
          },
          null,
          2
        ),
      },
    ],
  };
}
```

### 5. MCP Server Configuration

```json
// config/mcp-servers.json (UPDATE)

{
  "servers": {
    "gueclaw-memory": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "src/mcp/memory-server.ts"],
      "env": {
        "DATABASE_PATH": "${env:DATABASE_PATH}",
        "DATABASE_ENCRYPTION_KEY": "${env:DATABASE_ENCRYPTION_KEY}",
        "NODE_ENV": "production"
      }
    },
    
    // ... existing servers (n8n, playwright, etc)
  }
}
```

---

## 🧪 TESTES

### Test Strategy

```typescript
// tests/mcp/memory-server.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('MCP Memory Server', () => {
  beforeAll(async () => {
    // Setup test database
    // Seed test memories
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('gueclaw_memory_search', () => {
    it('should return index results matching query', async () => {
      // Test
    });

    it('should filter by type', async () => {
      // Test
    });

    it('should filter by importance', async () => {
      // Test
    });

    it('should limit results', async () => {
      // Test
    });

    it('should filter by confidence threshold', async () => {
      // Test
    });

    it('should count tokens accurately', async () => {
      // Test
    });
  });

  describe('gueclaw_memory_timeline', () => {
    it('should return timeline with before/after context', async () => {
      // Test
    });

    it('should mark target memory', async () => {
      // Test
    });

    it('should handle edge cases (first/last memory)', async () => {
      // Test
    });
  });

  describe('gueclaw_memory_get', () => {
    it('should return full details for IDs', async () => {
      // Test
    });

    it('should batch multiple IDs', async () => {
      // Test
    });

    it('should report not found IDs', async () => {
      // Test
    });
  });
});
```

**Coverage Target:** >80%

---

## 📋 CHECKLIST

### Development

- [ ] **Setup**
  - [ ] Install MCP SDK: `npm install @modelcontextprotocol/sdk`
  - [ ] Setup ts-node for TypeScript support
  - [ ] Create `src/mcp/` directory

- [ ] **Core Implementation**
  - [ ] Implement `memory-server.ts` (280 LOC)
  - [ ] Define MCP types (`types.ts`)
  - [ ] Implement `search-tool.ts` (150 LOC)
  - [ ] Implement `timeline-tool.ts` (180 LOC)
  - [ ] Implement `get-memories-tool.ts` (120 LOC)

- [ ] **Utilities**
  - [ ] Create `formatter.ts` (response formatting)
  - [ ] Create `token-counter.ts` (token tracking)

- [ ] **Configuration**
  - [ ] Update `config/mcp-servers.json`
  - [ ] Add VS Code settings for MCP
  - [ ] Document environment variables

### Testing

- [ ] **Unit Tests**
  - [ ] Search tool tests (90 LOC)
  - [ ] Timeline tool tests (100 LOC)
  - [ ] Get memories tool tests (70 LOC)
  - [ ] Server integration tests (180 LOC)
  - [ ] Achieve >80% coverage

- [ ] **Manual Testing**
  - [ ] Test in VS Code Copilot Chat
  - [ ] Verify Progressive Disclosure workflow
  - [ ] Validate token counting accuracy
  - [ ] Test error handling

### Documentation

- [ ] **Usage Guide**
  - [ ] Create `docs/mcp-memory-usage.md`
  - [ ] Add VS Code setup instructions
  - [ ] Document all 3 tools with examples
  - [ ] Add Progressive Disclosure best practices

- [ ] **Skill Integration**
  - [ ] Create/update skill for MCP memory search
  - [ ] Add examples to skill documentation
  - [ ] Update README with MCP features

### QA

- [ ] **Code Quality**
  - [ ] TypeScript strict mode (no errors)
  - [ ] ESLint passing
  - [ ] Tests passing (>80% coverage)
  - [ ] No console.log in production code

- [ ] **Performance**
  - [ ] Search < 200ms (10 results)
  - [ ] Timeline < 100ms
  - [ ] Get < 50ms (batch of 5)
  - [ ] Token counting overhead < 10ms

- [ ] **Security**
  - [ ] Validate all user inputs
  - [ ] Sanitize query strings
  - [ ] Check memory access permissions (future: user isolation)

---

## 📊 SUCCESS METRICS

### Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Search latency | < 200ms | TBD |
| Timeline latency | < 100ms | TBD |
| Get latency | < 50ms | TBD |
| Token economy | >60% savings | TBD |
| Test coverage | >80% | TBD |

### User Experience

- ✅ VS Code Copilot Chat integration working
- ✅ Progressive Disclosure workflow documented
- ✅ Examples clear and actionable
- ✅ Error messages helpful

---

## 🚀 ROLLOUT PLAN

### Day 1-2: Core Implementation
- Setup MCP server infrastructure
- Implement search tool (Layer 1)
- Basic testing

### Day 3-4: Progressive Layers
- Implement timeline tool (Layer 2)
- Implement get memories tool (Layer 3)
- Token counting utilities

### Day 5: Testing
- Write comprehensive unit tests
- Manual VS Code testing
- Performance benchmarks

### Day 6: Documentation
- Usage guide
- Skill documentation
- README updates

### Day 7: QA & Deploy
- Code review
- Final testing
- Deploy to production
- Monitor usage

---

## 🔮 FUTURE ENHANCEMENTS (Not in Scope)

### Phase 2: Vector Search
- Chroma DB integration
- Semantic embeddings
- Hybrid search (semantic + keyword)

### Phase 3: Web Viewer
- React dashboard
- Real-time memory stream
- Analytics & stats

### Phase 4: Advanced Features
- Full lifecycle hooks
- Auto-capture on tool execution
- Smart memory pruning
- Cross-user memory sharing (team mode)

---

## 📚 REFERÊNCIAS

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude-Mem Repository](https://github.com/thedotmack/claude-mem)
- [GueClaw Phase 3.2](./PHASE-3-2-ADVANCED-MEMORY-COMPLETE.md)
- [Progressive Disclosure Pattern](https://docs.claude-mem.ai/progressive-disclosure)

---

**Status:** 📝 READY FOR IMPLEMENTATION  
**Aprovação:** Aguardando decisão do usuário  
**Next Step:** Aprovar e começar Day 1
