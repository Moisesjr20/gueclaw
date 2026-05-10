# GueClaw · Plano de Refatoração — RAG Profundo + LLM Routing CoT
## Versão 1.0 · Maio 2026

> **Escopo consolidado:**
> 1. Remoção do Mayan EDMS (libera ~3.3 GB RAM)
> 2. Substituição por RAG Profundo em diretório (PostgreSQL + pgvector + SQLite)
> 3. Refatoração do LLM Routing (Smart Routing regras → CoT semântico via OpenRouter)

---

## CONTEXTO: O QUE EXISTE E O QUE MUDA

### Situação atual

| Componente | Status | Problema |
|---|---|---|
| Mayan EDMS | Código pronto, **nunca deployado** | 3.3 GB RAM (42% da VPS), 5 containers |
| document_upload/query/analyze/audit | Dependem do Mayan | Inutilizáveis sem o deploy |
| Smart Routing | Regras determinísticas (length + keywords) | Cego à semântica da tarefa |
| OpenRouterProvider | Já existe, modelo fixo | Não faz roteamento inteligente entre modelos |

### O que NÃO muda

- Arquitetura DVACE (agent-loop, tool-orchestrator, task-tracking)
- SQLite e todo o schema atual (conversations, messages, financial, FTS5)
- Skills, cron, context files, subagentes paralelos
- Error Recovery System, Heartbeat, Debug API
- Interface Telegram e todos os handlers
- Tools existentes: vps-command, docker, file-ops, api-request, cron, grep, glob, delegate, memory, etc.
- Todos os outros providers LLM (GitHub Copilot, DeepSeek, Anthropic, Gemini)

---

## MAPA DE ARQUIVOS

### Remover
```
src/clients/mayan-edms-client.ts
src/tools/document-upload-tool.ts
src/tools/document-query-tool.ts
src/tools/document-analyze-tool.ts
src/tools/document-audit-tool.ts
deploy/mayan-edms/            (pasta inteira)
__tests__/clients/mayan-edms-client.test.ts
```

### Manter (sem mudança)
```
src/services/document-security-analyzer.ts    ← TypeScript puro, nenhuma dep do Mayan
src/core/providers/ollama-cloud-provider.ts   ← LLM provider genérico, útil
src/core/providers/openrouter-provider.ts     ← modificar, não recriar
src/core/providers/provider-factory.ts        ← modificar getProviderForMessage()
```

### Criar — RAG
```
src/services/rag/
├── rag-database.ts         ← conexão PostgreSQL (separada do SQLite)
├── rag-indexer.ts          ← chunking + embedding + upsert no pgvector
├── rag-searcher.ts         ← busca semântica via pgvector
└── rag-types.ts            ← interfaces e tipos

src/tools/
├── rag-index-tool.ts       ← substitui document-upload-tool.ts
├── rag-search-tool.ts      ← substitui document-query-tool.ts
├── rag-analyze-tool.ts     ← substitui document-analyze-tool.ts
└── rag-audit-tool.ts       ← substitui document-audit-tool.ts

data/documents/             ← armazenamento local dos arquivos originais
└── .gitkeep
```

### Criar — LLM Routing CoT
```
src/types/routing-types.ts
src/services/llm-router/
├── cot-triage.ts           ← núcleo: classifica tarefa via DeepSeek R1
├── router-config.ts        ← mapa de especialistas e system prompts
└── router-logger.ts        ← logging de decisões de roteamento
```

### Modificar
```
src/core/providers/openrouter-provider.ts     ← adicionar CoT interno
src/core/providers/provider-factory.ts        ← ajuste em getProviderForMessage()
src/index.ts                                  ← trocar document-* por rag-*
.env / .env.example                           ← novas variáveis
```

---

## ARQUITETURA RAG

### Duas databases, dois propósitos

```
SQLite (gueclaw.db)          PostgreSQL + pgvector
─────────────────────        ─────────────────────────────────
conversations                document_chunks
messages (FTS5)              ├── id, file_path, chunk_index
skill_executions             ├── content TEXT
execution_traces             ├── embedding vector(1536)   ← pgvector
financial_transactions       └── metadata JSONB

Agente, histórico,           RAG, embeddings,
conversas, custo             busca semântica
```

### Fluxo de indexação

```
Arquivo (PDF/TXT/MD) → pdf-parse / leitura direta
  → SecurityAnalyzer (PII, classificação)
  → Chunker (~500 tokens com 50 de overlap)
  → Embedding via OpenRouter (text-embedding-3-small)
  → upsert em document_chunks (pgvector)
  → arquivo original salvo em data/documents/YYYY-MM/
```

### Fluxo de busca

```
Pergunta → embedding da query via OpenRouter
  → SELECT via pgvector (<=> cosine similarity)
  → top-5 chunks relevantes
  → LLM principal responde com contexto dos chunks
```

### Schema PostgreSQL

```sql
-- Habilitar extensão (executar uma vez)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id           SERIAL PRIMARY KEY,
  file_hash    TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  metadata     JSONB DEFAULT '{}'::jsonb,
  indexed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(file_hash, chunk_index)
);

CREATE TABLE IF NOT EXISTS document_metadata (
  id               SERIAL PRIMARY KEY,
  file_hash        TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  stored_path      TEXT NOT NULL,
  file_size        INTEGER,
  tags             TEXT[] DEFAULT '{}',
  security_level   TEXT DEFAULT 'internal',
  pii_count        INTEGER DEFAULT 0,
  indexed_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice ivfflat para busca vetorial eficiente
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## ARQUITETURA LLM ROUTING COT

### Problema atual

```
getProviderForMessage(msg):
  se msg.length < 160 chars E sem keyword → DeepSeek Fast
  senão → provider padrão (fixo)
```

Cego à semântica. Não distingue "calcule o break-even" (reasoning) de "crie um workflow n8n" (agentic).

### Nova arquitetura

```
getProviderForMessage(msg):
  se OPENROUTER_API_KEY + ROUTER_COT_ENABLED=true:
    → OpenRouterProvider (CoT interno)
        → CotTriage.classify(msg) via DeepSeek R1
        → seleciona especialista (reasoning/agentic/text/fast/longoutput/code)
        → chama modelo correto via OpenRouter
  senão:
    → lógica atual (mantida como fallback)
```

### Especialistas

| Chave | Modelo | Quando |
|---|---|---|
| reasoning | deepseek/deepseek-r1 | Lógica, cálculos, debugging, finanças |
| agentic | moonshotai/kimi-k2 | Workflows n8n, automações, pipelines |
| text | qwen/qwen3.5-plus-20260420 | Emails, relatórios, comunicação |
| fast | google/gemma-4-27b-it | Respostas curtas, confirmações |
| longoutput | thudm/glm-4-plus | Documentação extensa, planos longos |
| code | deepseek/deepseek-r1 | TypeScript, Python, arquitetura |
| fallback | deepseek/deepseek-chat | Quando especialista falha |

### Interface real do projeto (base-provider.ts)

```typescript
// A interface REAL é ILLMProvider com:
interface ILLMProvider {
  readonly name: string;
  generateCompletion(messages: Message[], options?: CompletionOptions): Promise<LLMResponse>;
  getModel?(): string;
  setModel?(model: string): void;
}
// NÃO usa BaseProvider/complete() — usar ILLMProvider/generateCompletion()
```

### Integração no OpenRouterProvider existente

O `openrouter-provider.ts` já existe e implementa `ILLMProvider`. A mudança é:
1. Adicionar `CotTriage` internamente
2. Em `generateCompletion()`: se `ROUTER_COT_ENABLED=true`, rodar triagem antes de chamar o modelo
3. O modelo selecionado pela triagem substitui o modelo configurado fixo

```typescript
// Fluxo modificado em generateCompletion():
if (process.env.ROUTER_COT_ENABLED === 'true') {
  const userMsg = messages.filter(m => m.role === 'user').at(-1)?.content || '';
  const triage = await getCotTriage().classify(userMsg);
  const specialist = getSpecialistConfigs()[triage.specialist];
  // usar specialist.model_id e specialist.system_prompt
} else {
  // comportamento atual: usa this.model fixo
}
```

---

## VARIÁVEIS DE AMBIENTE

### Adicionar ao .env

```env
# ─── RAG (PostgreSQL + pgvector) ────────────────────────────────
RAG_POSTGRES_URL=postgresql://gueclaw:senha@localhost:5432/gueclaw_rag
RAG_DOCUMENTS_DIR=./data/documents
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small   # via OpenRouter
RAG_TOP_K=5

# ─── LLM Routing CoT ────────────────────────────────────────────
ROUTER_COT_ENABLED=true
ROUTER_DEBUG_LOG=true

# Triador (usa OpenRouter já configurado acima)
ROUTER_TRIAGE_MODEL=deepseek/deepseek-r1
ROUTER_TRIAGE_MAX_TOKENS=800
ROUTER_TRIAGE_TEMPERATURE=0.1

# Especialistas (todos via OpenRouter)
ROUTER_MODEL_REASONING=deepseek/deepseek-r1
ROUTER_MODEL_AGENTIC=moonshotai/kimi-k2
ROUTER_MODEL_TEXT=qwen/qwen3.5-plus-20260420
ROUTER_MODEL_FAST=google/gemma-4-27b-it
ROUTER_MODEL_LONGOUTPUT=thudm/glm-4-plus
ROUTER_MODEL_CODE=deepseek/deepseek-r1
ROUTER_FALLBACK_MODEL=deepseek/deepseek-chat

# OpenRouter (se ainda não configurado)
OPENROUTER_API_KEY=sk-or-v1-PREENCHER
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=GueClaw-Agent
OPENROUTER_HTTP_REFERER=https://kyrius.com.br
```

### Remover do .env (após confirmar)

```env
# Estas variáveis deixam de ser necessárias:
MAYAN_API_URL=
MAYAN_API_TOKEN=
OLLAMA_CLOUD_API_KEY=        # apenas se não for mais usar Ollama Cloud
```

---

## CHECKLIST DE EXECUÇÃO

> Execute as fases nesta ordem. Marque cada item antes de avançar.

---

### FASE 1 — RECONHECIMENTO ✅ COMPLETA

```
[x] 1.1  Ler src/core/providers/base-provider.ts
         → ILLMProvider, generateCompletion(), Message/LLMResponse/CompletionOptions confirmados

[x] 1.2  Ler src/core/providers/openrouter-provider.ts
         → Bug encontrado: supportsToolCalls=false; construtor correto (apiKey, baseUrl, model, maxTokens, temp)

[x] 1.3  Ler src/core/providers/provider-factory.ts
         → Bug encontrado: new OpenRouterProvider(apiKey, OPENROUTER_MODEL, APP_NAME)
           — OPENROUTER_MODEL era passado como baseUrl

[x] 1.4  Ler src/core/providers/smart-routing.ts
         → chooseModel(), getDefaultRoutingConfig() — mantidos como fallback legado

[x] 1.5  Ler src/core/agent-loop/agent-loop.ts (linhas 1-80)
         → Linha 125: checa supportsToolCalls antes de passar tools; linha 133: generateCompletion()

[x] 1.6  Grep de pontos de uso
         → getProviderForMessage() era dead-code; agent-controller usava getFastProvider() diretamente

[x] 1.7  Instalar dependências Node.js para Postgres:
         → npm install pg  (nota: @pgvector/pg não existe no npm — desnecessário)
         → npm install --save-dev @types/pg
```

---

### FASE 2 — REMOÇÃO DO MAYAN EDMS ✅ COMPLETA

```
[x] 2.1  Remover arquivos de código Mayan:
         → Deletados: mayan-edms-client.ts, document-upload/query/analyze/audit-tool.ts,
           __tests__/clients/mayan-edms-client.test.ts

[x] 2.2  Remover pasta de deploy:
         → Deletado: deploy/mayan-edms/ (inteira)

[x] 2.3  Limpar src/index.ts:
         → Imports e registros das 4 document-* tools removidos

[x] 2.4  Limpar .env:
         → MAYAN_API_URL, MAYAN_API_TOKEN comentados

[x] 2.5  Build de validação:
         → npm run build → 0 erros TS ✅
```

---

### FASE 3 — INFRAESTRUTURA RAG (PostgreSQL + pgvector) ✅ COMPLETA

```
[x] 3.1  Criar deploy/postgres-rag/docker-compose.yml
         → Imagem: pgvector/pgvector:pg17, porta 5433, volume /opt/gueclaw/postgres-rag, 512 MB RAM

[x] 3.2  Criar data/documents/.gitkeep

[x] 3.3  Instalar pg + @types/pg (npm install pg && npm install --save-dev @types/pg)

[x] 3.4  Criar src/services/rag/rag-types.ts
         → RagDocument, RagChunk, RagSearchResult, IndexingOptions, IndexingResult, SearchFilters

[x] 3.5  Criar src/services/rag/rag-database.ts
         → Singleton Pool pg, initSchema() cria extension vector + tabelas document_metadata e document_chunks

[x] 3.6  Criar src/services/rag/rag-indexer.ts
         → indexFile(): PDF/texto, SecurityAnalyzer, chunking, embeddings via OpenRouter, upsert pg
         → removeFile(): DELETE CASCADE

[x] 3.7  Criar src/services/rag/rag-searcher.ts
         → search(): embedding da query + ORDER BY embedding <=> $1::vector LIMIT $k
         → getDocument(), listDocuments() com filtros tag/securityLevel/filename
```

---

### FASE 4 — TOOLS RAG ✅ COMPLETA

```
[x] 4.1  Criar src/tools/rag-index-tool.ts (rag_index — actions: index / remove)

[x] 4.2  Criar src/tools/rag-search-tool.ts (rag_search — busca semântica com minSimilarity)

[x] 4.3  Criar src/tools/rag-analyze-tool.ts (rag_analyze — retorna contexto formatado para injeção em prompt)

[x] 4.4  Criar src/tools/rag-audit-tool.ts (rag_audit — actions: list / stats / get)

[x] 4.5  Registrar as 4 novas tools em src/index.ts + conectar RagDatabase no start()

[x] 4.6  Build de validação:
         → npm run build → 0 erros TS ✅
```

---

### FASE 5 — LLM ROUTING CoT ✅ COMPLETA (exceto 5.8)

```
[x] 5.1  Criar src/types/routing-types.ts
         → RouterCategory (7 categorias), TriageDecision

[x] 5.2  Criar src/services/llm-router/router-logger.ts
         → logTriageDecision(): loga categoria, modelo, confiança, latência e preview da mensagem

[x] 5.3  Criar src/services/llm-router/router-config.ts
         → SpecialistModels, getSpecialistModels() (lê ROUTER_MODEL_* do .env)
         → TRIAGE_SYSTEM_PROMPT para DeepSeek R1

[x] 5.4  Criar src/services/llm-router/cot-triage.ts
         → CotTriage.classify(): chama DeepSeek R1 via OpenRouter (axios, timeout 8s)
         → Parseia <think>...</think> + JSON; fallback heurístico automático se falhar
         → ROUTER_COT_ENABLED=false → usa heurística sem chamada LLM (zero custo)

[x] 5.5  Modificar src/core/providers/openrouter-provider.ts:
         → supportsToolCalls: false → true
         → generateCompletion(): adiciona tools/tool_choice ao payload quando opts.tools presente
         → Bug do construtor na factory corrigido (OPENROUTER_MODEL era passado como baseUrl)

[x] 5.6  Ajustar src/core/providers/provider-factory.ts:
         → Corrigido: new OpenRouterProvider(apiKey, OPENROUTER_BASE_URL, OPENROUTER_MODEL)
         → getProviderForMessage() reescrito como async: usa CotTriage.classify() quando OpenRouter
           disponível; fallback para regras legacy (chooseModel) caso contrário
         → agent-controller.ts: ambos getFastProvider() substituídos por getProviderForMessage()

[x] 5.7  Adicionar variáveis ao .env:
         → RAG_POSTGRES_URL, RAG_DOCUMENTS_DIR, RAG_EMBEDDING_MODEL, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP, RAG_TOP_K
         → ROUTER_COT_ENABLED=false (ativar na VPS), ROUTER_TRIAGE_MODEL
         → ROUTER_MODEL_REASONING/AGENTIC/TEXT/FAST/LONGOUTPUT/CODE/FALLBACK

[ ] 5.8  Adicionar comando /routing no Telegram:
         → Pendente — exibir última decisão de roteamento (categoria, modelo, confiança, latência)

[x] 5.9  Build de validação:
         → npm run build → 0 erros TS ✅
```

---

### FASE 6 — TESTES ✅ AUTOMATIZADOS COMPLETOS (6.6–6.8 pendentes — VPS)

```
[x] 6.1  Criar tests/unit/llm-router/cot-triage.test.ts
         → 16 testes: CoT com API real (mocked axios), fallback heurístico,
           strips <think>, network error, JSON inválido, mode desabilitado,
           greetings→fast, docker→agentic, código→code, análise→reasoning

[x] 6.2  Criar tests/unit/llm-router/router-config.test.ts
         → 13 testes: 7 categorias presentes, model IDs não vazios,
           env vars ROUTER_MODEL_* overrides, modelForCategory, TRIAGE_SYSTEM_PROMPT

[x] 6.3  Criar tests/unit/rag/rag-indexer.test.ts
         → 10 testes: indexFile() arquivo válido (chunksIndexed>0, embedding×chunks,
           query calls, securityLevel, piiCount, tags, skipSecurity),
           arquivo inexistente (success=false), embeddings falham (errors preenchidos),
           removeFile() (DELETE correto)

[x] 6.4  Criar tests/unit/rag/rag-searcher.test.ts
         → 14 testes: search() shape completo, embedding gerado, topK passado ao SQL,
           0 resultados, múltiplos resultados, tags+securityLevel mapeados,
           getDocument() found/null/params, listDocuments() vazio/múltiplos/campos

[x] 6.5  Executar testes:
         → npm run test:unit → 284/284 passando (0 falhas) ✅
         → 53 novos testes adicionados (231 → 284)
         → npm run build → 0 erros TypeScript ✅

[ ] 6.6  Teste de integração manual — RAG: (requer VPS com Postgres rodando)
         → docker compose -f deploy/postgres-rag/docker-compose.yml up -d
         → Indexar documento real via Telegram e buscar por tópico

[ ] 6.7  Teste de integração manual — CoT Routing: (requer VPS + OPENROUTER_API_KEY)
         → ROUTER_COT_ENABLED=true, testar categorias via mensagens Telegram

[ ] 6.8  Teste de rollback:
         → ROUTER_COT_ENABLED=false → confirmar resposta via heurística
```

---

### FASE 7 — PRODUÇÃO ⏳ PENDENTE

```
[ ] 7.1  Atualizar .env.example com todos os novos blocos (RAG + Router)

[ ] 7.2  Deploy PostgreSQL RAG na VPS:
         → ssh root@147.93.69.211
         → docker compose -f /opt/gueclaw/deploy/postgres-rag/docker-compose.yml up -d
         → Verificar: docker ps | grep postgres-rag
         → Testar conexão: psql $RAG_POSTGRES_URL -c "SELECT version();"

[ ] 7.3  Configurar .env de produção na VPS:
         → RAG_POSTGRES_URL com senha segura (não "changeme")
         → OPENROUTER_API_KEY com chave real
         → ROUTER_COT_ENABLED=true
         → Remover linhas MAYAN_* se ainda existirem

[ ] 7.4  Build e deploy do agente:
         → npm run build
         → pm2 restart gueclaw-agent
         → pm2 logs gueclaw-agent --lines 50
         → Confirmar: "✅ RAG Database connected" nos logs

[ ] 7.5  Smoke test em produção:
         → Enviar mensagem simples → responde normalmente
         → Indexar um documento de teste via rag_index
         → Buscar no documento indexado via rag_search
         → Verificar /cost → custos registrados para openrouter

[ ] 7.6  Monitoramento pós-deploy:
         → free -h → RAM esperada: ~1.9 GB (era até 4.9 GB com Mayan)
         → Confirmar que não há containers Mayan rodando
```

---

## DEPENDÊNCIAS NPM A INSTALAR

```bash
# Runtime (RAG)
npm install pg @pgvector/pg

# Dev types
npm install --save-dev @types/pg

# Já instalados (verificar se precisam de update):
# openai ^4.x — já no projeto, usado pelo OpenRouterProvider
# pdf-parse — já no projeto, usado para extração de texto
# zod — já no projeto
```

## DEPENDÊNCIAS A REMOVER (opcional, após confirmação)

```bash
# Apenas se não houver mais uso em nenhum lugar:
# axios — mayan-edms-client usava, mas outros providers também usam — MANTER
# Nenhuma remoção obrigatória neste momento
```

---

## SAFE ROLLBACK

### Rollback do CoT Routing (imediato, sem deploy)

```bash
# Desativa o CoT sem tocar código
ROUTER_COT_ENABLED=false  # no .env
pm2 restart gueclaw-agent
# OpenRouterProvider volta ao comportamento de modelo fixo
```

### Rollback do RAG (sem impacto no agente)

```bash
# As tools rag_* simplesmente não funcionam se o Postgres estiver down
# O agente continua operando normalmente — só as tools RAG retornam erro
# Para desativar completamente: remover do ToolRegistry em src/index.ts
```

### Rollback do Mayan (não recomendado)

```bash
# git checkout main -- src/clients/mayan-edms-client.ts src/tools/document-*.ts
# Mayan nunca foi deployado na VPS, então não há estado para restaurar
```

---

## RESUMO DE IMPACTO

| Métrica | Antes | Depois |
|---|---|---|
| RAM usada (se Mayan fosse deployado) | ~4.9 GB | ~1.9 GB |
| RAM disponível na VPS | ~4.6 GB | ~5.9 GB |
| Containers de dependência do doc system | 5 (Postgres/Redis/RabbitMQ/Mayan/Tesseract) | 1 (Postgres) |
| Qualidade da busca documental | Texto simples (BM25) | Semântica (pgvector cosine) |
| Modelos disponíveis via routing | 1 por config | 7 especializados |
| Qualidade do routing | Heurística por keywords | CoT semântico via DeepSeek R1 |
| Fallback de routing | Sem fallback automático | Determinístico + fallback model |

---

*Plano gerado em 2026-05-10 · GueClaw · Kyrius Consulting*
