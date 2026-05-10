# 🤖 GueClaw Agent - VPS Edition

**GueClaw** é um agente de IA pessoal projetado para operar completamente em uma VPS, com controle total do ambiente via Telegram. Alimentado por múltiplos LLMs com **CoT Routing automático** (DeepSeek R1 classifica cada mensagem e roteia para 7 especialistas via OpenRouter), inclui **RAG Profundo** (PostgreSQL + pgvector para busca semântica em documentos), gerencia Docker, executa comandos, processa arquivos multimodais e pode criar suas próprias skills.

---

## ✨ Características Principais

### 🔀 **CoT Routing — 7 Modelos Especialistas**

O GueClaw usa **DeepSeek R1 como triage inteligente**: cada mensagem é classificada com Chain-of-Thought antes de ser roteada para o modelo mais adequado.

| Categoria | Modelo Padrão | Quando usar |
|-----------|--------------|-------------|
| `reasoning` | deepseek/deepseek-r1 | Matemática, lógica, análise estratégica |
| `agentic` | moonshotai/kimi-k2 | Docker, shell, automação, ferramentas |
| `text` | qwen/qwen3-235b-a22b | Redação, emails, relatórios, tradução |
| `fast` | google/gemma-3-27b-it | Saudações, perguntas simples, respostas rápidas |
| `longoutput` | thudm/glm-z1-32b | Documentos longos, código extenso |
| `code` | deepseek/deepseek-r1 | TypeScript, Python, debugging, review |
| `fallback` | deepseek/deepseek-chat-v3-0324 | Qualquer categoria não reconhecida |

**Fallback automático**: se o CoT falhar (rede, JSON inválido), usa heurística local instantânea (regex + comprimento).

### 📚 **RAG Profundo (PostgreSQL + pgvector)**

Indexe documentos e faça buscas semânticas com embeddings de alta qualidade:

- **PostgreSQL + pgvector**: armazenamento vetorial com operador `<=>` (cosine distance)
- **Embedding**: `openai/text-embedding-3-small` via OpenRouter (1536 dimensões)
- **Segurança**: análise de PII automática, classificação `public/internal/confidential/secret`
- **Chunking**: parágrafos de ~500 tokens com overlap configurável
- **4 ferramentas RAG**: index, search, analyze, audit

### 🧠 **Multi-LLM Support**
- **OpenRouter**: Acesso a 200+ modelos — único API key para todos os especialistas
- **DeepSeek**: Fast (deepseek-chat) + Reasoner (deepseek-r1) direto
- **Anthropic Direct**: Claude Opus 4.7, Sonnet 4.6, Haiku 4.5
- **Google Gemini**: Gemini Pro/Flash via AI Studio
- **OpenAI Direct**: GPT-4o, GPT-4 Turbo

### 🛠️ **Controle Total da VPS**
- Execução de comandos shell com acesso total
- Gerenciamento completo de Docker (containers, images, compose)
- Operações de arquivo (ler, escrever, criar, deletar)
- Requisições HTTP para integração com APIs externas

### 📚 **Sistema de Skills Modular**
- Hot-reload de skills sem reiniciar o agente
- Skill de **self-improvement**: o agente pode criar suas próprias skills
- Roteamento inteligente para escolher a skill apropriada

### 🎛️ **Multimodal Input/Output**
- ✅ **Input**: PDF, CSV, imagens, áudio/voz, texto
- ✅ **Output**: Texto (chunked), arquivos Markdown, imagens, áudio
- Processamento automático de anexos do Telegram

### 💾 **Memória Persistente**
- SQLite local com suporte a WAL (Write-Ahead Logging)
- Histórico de conversas com janela de contexto configurável
- Cleanup automático de conversas antigas

### 📁 **Context Files**
- Sistema de contexto pessoal injetado automaticamente em cada conversa
- Elimina a necessidade de repetir informações sobre você, preferências e projetos
- Gerenciamento via comando `/context [show|create|reload]`

### 👥 **Subagentes Paralelos**
- Sistema de delegação de tarefas para execução paralela
- Contexto isolado: cada subagente tem seu próprio histórico
- Max concurrent: 3-5 tarefas simultâneas com queue FIFO

### 🔒 **Segurança**
- Whitelist estrita baseada em IDs do Telegram
- Análise automática de PII em documentos indexados
- Varredura de segurança diária da VPS (SecurityMonitor)
- Logs detalhados de todas as operações

---

## 📋 Pré-requisitos

### VPS Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+
- **RAM**: Mínimo 2GB (recomendado 4GB+ com RAG)
- **Disk**: 20GB+ livres (incluindo PostgreSQL)
- **Node.js**: v20.0.0+
- **Docker**: Instalado e rodando (obrigatório para RAG)

### Serviços Externos
- **Telegram Bot Token**: Crie um bot via [@BotFather](https://t.me/BotFather)
- **OpenRouter API Key**: [openrouter.ai](https://openrouter.ai) — único key para todos os modelos

---

## 🚀 Instalação

### 1. Clone o Repositório

```bash
cd /opt
git clone https://github.com/Moisesjr20/gueclaw.git gueclaw-agent
cd gueclaw-agent
```

### 2. Instale Dependências e Build

```bash
npm install
npm run build
```

### 3. Configure Variáveis de Ambiente

```bash
cp .env.example .env
nano .env
```

#### Configuração Mínima (sem RAG)

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ALLOWED_USER_IDS=123456789

# OpenRouter (principal)
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=deepseek/deepseek-r1

# Agent
MAX_ITERATIONS=5
MEMORY_WINDOW_SIZE=10
```

#### Ativar CoT Routing (Recomendado)

```env
# CoT Triage — classifica via DeepSeek R1
ROUTER_COT_ENABLED=true
ROUTER_TRIAGE_MODEL=deepseek/deepseek-r1

# Modelos especialistas (override por categoria)
ROUTER_MODEL_REASONING=deepseek/deepseek-r1
ROUTER_MODEL_AGENTIC=moonshotai/kimi-k2
ROUTER_MODEL_TEXT=qwen/qwen3-235b-a22b
ROUTER_MODEL_FAST=google/gemma-3-27b-it
ROUTER_MODEL_LONGOUTPUT=thudm/glm-z1-32b
ROUTER_MODEL_CODE=deepseek/deepseek-r1
ROUTER_MODEL_FALLBACK=deepseek/deepseek-chat-v3-0324
```

#### Ativar RAG Profundo (PostgreSQL + pgvector)

```env
# PostgreSQL RAG
RAG_POSTGRES_URL=postgresql://gueclaw:changeme@localhost:5433/gueclaw_rag
RAG_DOCUMENTS_DIR=./data/documents
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_TOP_K=5
```

### 4. Suba o PostgreSQL RAG (se usar RAG)

```bash
docker compose -f deploy/postgres-rag/docker-compose.yml up -d
```

### 5. Crie Diretórios e Inicie

```bash
mkdir -p data/documents tmp logs .agents/skills
npm run dev
```

---

## 🎯 Uso

### Comandos do Bot

- `/start` - Mensagem de boas-vindas
- `/help` - Mostrar ajuda
- `/stats` - Ver estatísticas do agente
- `/reload` - Recarregar skills (hot-reload)
- `/context [show|create|reload]` - Gerenciar contexto pessoal
- `/cost [today|week|month]` - Ver custos de uso do LLM
- `/tasks` - Listar tarefas ativas
- `/cron list|status|delete|pause|trigger` - Gerenciar jobs agendados

### Exemplos de Uso

#### 1. **Gerenciamento do Sistema**

```
📱 Você: Mostre o uso de disco da VPS

🤖 GueClaw: [Router → agentic → kimi-k2]
[Executa: df -h]
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1        80G   45G   32G  59% /
```

#### 2. **Busca em Documentos (RAG)**

```
📱 Você: Quais foram as despesas de marketing em março?

🤖 GueClaw: [Router → reasoning → deepseek-r1]
[rag_search: "despesas de marketing março"]
🔍 3 resultado(s) encontrado(s):
---
**[1] relatorio-q1-2026.pdf** (91.2% relevância)
🔒 confidential | 🏷️ financeiro | Chunk #3

...R$ 45.000 em campanhas de marketing digital em março...
```

#### 3. **Indexar Documentos no RAG**

```
📱 Você: Indexe o arquivo /data/contratos/contrato-cliente-abc.pdf

🤖 GueClaw: [rag_index: index /data/contratos/contrato-cliente-abc.pdf]
✅ Indexado com sucesso!
📄 Hash: a3f9e2b1...
🧩 Chunks: 12
🔒 Segurança: confidential
🔍 PII detectado: 3 ocorrência(s)
```

#### 4. **Docker Management**

```
📱 Você: Liste todos os containers Docker

🤖 GueClaw: [Router → agentic → kimi-k2]
[Executa: docker ps -a]
CONTAINER ID   IMAGE          STATUS         NAMES
abc123...      nginx:latest   Up 2 days      web-server
def456...      postgres:14    Up 5 days      database
```

#### 5. **Criação de Skills**

```
📱 Você: Crie uma skill para fazer backup do PostgreSQL

🤖 GueClaw: [Router → code → deepseek-r1]
✅ Skill 'postgres-backup' criada!
Localização: .agents/skills/postgres-backup/SKILL.md
```

---

## 📚 RAG Profundo

O GueClaw inclui um sistema completo de RAG (Retrieval-Augmented Generation) baseado em PostgreSQL + pgvector para busca semântica em documentos corporativos.

### Arquitetura

```
Documento → RagIndexer → chunks → embeddings → PostgreSQL (pgvector)
Pergunta  → embedding  → cosine distance search → top-K chunks → LLM
```

### Setup PostgreSQL + pgvector

```bash
# Suba o container
docker compose -f deploy/postgres-rag/docker-compose.yml up -d

# Configure o .env
RAG_POSTGRES_URL=postgresql://gueclaw:SENHA_FORTE@localhost:5433/gueclaw_rag
```

O schema é criado automaticamente na primeira conexão (`document_metadata` + `document_chunks` com `vector(1536)`).

### 4 Ferramentas RAG

| Ferramenta | Descrição |
|------------|-----------|
| `rag_index` | Indexa arquivos PDF/texto; actions: `index`, `remove` |
| `rag_search` | Busca semântica com filtros de tags/segurança/arquivo |
| `rag_analyze` | Retorna contexto formatado para injeção no prompt |
| `rag_audit` | Auditoria: `list`, `stats`, `get` de documentos indexados |

### Níveis de Segurança

- `public` — documento sem restrições
- `internal` — uso interno da empresa
- `confidential` — acesso restrito
- `secret` — máxima restrição

A classificação é automática via análise de PII (regex) no momento da indexação.

### Exemplo de Fluxo Completo

```
1. Indexar: rag_index {action: "index", filePath: "/docs/relatorio.pdf", tags: ["financeiro"]}
2. Buscar:  rag_search {query: "despesas Q1 2026", topK: 5, tags: ["financeiro"]}
3. Analisar: rag_analyze {query: "despesas Q1", minSimilarity: 0.4} → bloco para prompt
4. Auditar: rag_audit {action: "stats"} → total docs, chunks, tamanho
```

---

## 🔀 CoT Routing — Como Funciona

### Fluxo de Classificação

```
Mensagem do usuário
       ↓
ROUTER_COT_ENABLED=true?
       ↓ sim              ↓ não
DeepSeek R1 (8s timeout)  Heurística local (instantânea)
       ↓
JSON: {category, confidence, reasoning}
       ↓
Válido? categoria em lista?
       ↓ sim         ↓ não
Roteia para       Fallback para
especialista      heurística
```

### Heurística Local (Fallback)

Quando o CoT não está disponível ou falha:

```
mensagem ≤ 6 palavras e sem keywords → fast
contém: typescript|python|código|debug|função → code
contém: docker|kubectl|bash|execute|deploy → agentic
contém: analise|compare|calcule|demonstre → reasoning
contém: escreva|redija|artigo|relatório → text
padrão → fallback
```

### Configuração de Logging

```env
DEBUG_ROUTING=true   # Loga: 🔀 Router [code] → deepseek-r1 (CoT, 91.2%, 234ms)
```

---

## ⏰ Cron Scheduler

Agendamento de tarefas automatizadas com acesso a todas as ferramentas.

### Comandos

```bash
/cron list              # Listar todos os jobs
/cron status            # Status do scheduler
/cron delete <job-id>   # Deletar job
/cron pause <job-id>    # Pausar
/cron resume <job-id>   # Retomar
/cron trigger <job-id>  # Executar agora
```

### Formatos de Schedule

| Formato | Exemplo | Descrição |
|---------|---------|-----------|
| **Intervalo** | `30m`, `2h`, `1d` | A cada X minutos/horas/dias |
| **Cron** | `0 7 * * *` | Todo dia às 7h |
| **ISO** | `2026-04-17T14:00` | Execução única |
| **Once** | `once 30m` | Daqui a 30 minutos, uma vez |

---

## 🏗️ Arquitetura DVACE

**DVACE** garante que o agente nunca reporte sucesso sem execução real de ferramentas.

### ReAct Pattern com Estados Validados

```
START → THINKING → TOOL_USE → THINKING → SUCCESS
         ↓                ↓
      MAX_ITER         ERROR
```

**Regras críticas:**
- `finish_reason='tool_calls'` → CONTINUA loop (executa tools)
- `finish_reason='stop'` → TERMINA loop
- Phase com `tool_executions = 0` → BLOQUEIA `completed`
- Estados terminais (`completed/failed/killed`) → IMUTÁVEIS

### Execução de Ferramentas

- **Concurrent**: ferramentas read-only executam em paralelo (⚡ 3x mais rápido)
- **Serial**: ferramentas de escrita executam sequencialmente (🔒 sem race conditions)
- **Zero Skipping**: `executions.length === toolCalls.length` sempre

---

## 📊 Cobertura de Testes

**284 testes unitários** validando toda a arquitetura:

| Suite | Testes |
|-------|--------|
| DVACE — Command System | 16 |
| DVACE — Query Loop Validation | 15 |
| DVACE — Tool Orchestration | 39 |
| DVACE — Task System | 14 |
| DVACE — Tool Permissions | 27 |
| DVACE — False-Positive Prevention | 10 |
| RAG — RagSearcher | 14 |
| RAG — RagIndexer | 10 |
| LLM Router — CotTriage | 16 |
| LLM Router — RouterConfig | 13 |
| **Total** | **284** |

```bash
# Rodar testes unitários
npm run test:unit

# Todos os testes
npm test
```

---

## 🏗️ Estrutura do Projeto

```
gueclaw-agent/
├── .agents/
│   └── skills/                    # Skills modulares (hot-reload)
│       ├── self-improvement/
│       └── vps-manager/
├── data/
│   ├── gueclaw.db                 # SQLite (memória do agente)
│   └── documents/                 # Documentos para indexar no RAG
├── deploy/
│   └── postgres-rag/
│       └── docker-compose.yml     # PostgreSQL + pgvector
├── DOE/
│   ├── Directives.md              # Protocolo de qualidade
│   └── PLANO-DE-TESTES.md        # Plano de testes
├── Plans/
│   └── PLANO-REFATORACAO-RAG-LLM-ROUTING.md
├── src/
│   ├── core/
│   │   ├── agent-loop/            # ReAct Pattern
│   │   ├── memory/                # SQLite repositories
│   │   ├── providers/             # LLM providers
│   │   │   ├── openrouter-provider.ts
│   │   │   ├── provider-factory.ts  # CoT routing wired here
│   │   │   └── ...
│   │   ├── skills/                # Sistema de skills
│   │   └── agent-controller.ts
│   ├── handlers/
│   │   ├── telegram-input-handler.ts
│   │   └── telegram-output-handler.ts
│   ├── services/
│   │   ├── llm-router/            # CoT Routing
│   │   │   ├── cot-triage.ts      # DeepSeek R1 classifier
│   │   │   ├── router-config.ts   # 7 specialist models
│   │   │   └── router-logger.ts   # Routing decision logs
│   │   └── rag/                   # RAG Profundo
│   │       ├── rag-database.ts    # PostgreSQL singleton
│   │       ├── rag-indexer.ts     # PDF/text → chunks → embeddings
│   │       ├── rag-searcher.ts    # Cosine distance search
│   │       └── security-analyzer.ts  # PII detection
│   ├── tools/
│   │   ├── base-tool.ts
│   │   ├── tool-registry.ts
│   │   ├── rag-index-tool.ts      # rag_index
│   │   ├── rag-search-tool.ts     # rag_search
│   │   ├── rag-analyze-tool.ts    # rag_analyze
│   │   ├── rag-audit-tool.ts      # rag_audit
│   │   ├── vps-command-tool.ts
│   │   ├── docker-tool.ts
│   │   ├── file-operations-tool.ts
│   │   └── api-request-tool.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── routing-types.ts       # RouterCategory, TriageDecision
│   └── index.ts                   # Entry point
├── tests/
│   └── unit/
│       ├── llm-router/
│       │   ├── cot-triage.test.ts
│       │   └── router-config.test.ts
│       └── rag/
│           ├── rag-indexer.test.ts
│           └── rag-searcher.test.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## 🚦 Rodando em Produção

### 1. PM2 (Recomendado)

```bash
npm install -g pm2
pm2 start dist/index.js --name gueclaw-agent
pm2 startup && pm2 save
pm2 logs gueclaw-agent
```

### 2. Systemd

```ini
[Unit]
Description=GueClaw AI Agent
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gueclaw-agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Checklist de Deploy VPS

```bash
# 1. PostgreSQL RAG
docker compose -f deploy/postgres-rag/docker-compose.yml up -d

# 2. Verificar conexão
psql $RAG_POSTGRES_URL -c "SELECT extversion FROM pg_extension WHERE extname='vector';"

# 3. .env produção
ROUTER_COT_ENABLED=true
RAG_POSTGRES_URL=postgresql://gueclaw:SENHA_FORTE@localhost:5433/gueclaw_rag

# 4. Build e start
npm run build
pm2 restart gueclaw-agent
```

---

## 🔧 Desenvolvimento

### Adicionar Nova Tool

```typescript
// src/tools/my-tool.ts
import { BaseTool } from './base-tool';
export class MyTool extends BaseTool {
  public readonly name = 'my_tool';
  public readonly description = 'O que a tool faz';

  public getDefinition(): ToolDefinition { /* ... */ }
  
  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      return this.success('OK');
    } catch (err: any) {
      return this.error(err.message);
    }
  }
}
```

Registre em `src/index.ts`:
```typescript
import { MyTool } from './tools/my-tool';
// na função registerTools():
new MyTool(),
```

### Rodar Testes

```bash
npm run test:unit    # Apenas unitários (sem dependências externas)
npm test             # Todos os testes
npm run test:watch   # Watch mode
```

---

## 📊 Monitoramento

```bash
# Logs PM2
pm2 logs gueclaw-agent --lines 100

# Status RAG database
/stats no Telegram

# Logs de routing (se DEBUG_ROUTING=true)
# 🔀 Router [code] → deepseek/deepseek-r1  (CoT, 91.2%, 234ms)
```

---

## 🔒 Segurança

### Whitelist de Usuários

```env
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

### Credenciais Seguras

- Nunca commite `.env` — está no `.gitignore`
- Use senha forte no `RAG_POSTGRES_URL`
- Configure SSH key ao invés de senha para VPS

### Varredura de Segurança

O `SecurityMonitor` faz varredura diária da VPS (portas, logins, containers, disco) e envia relatório via Telegram.

---

## ❓ Troubleshooting

### RAG não conecta

```
⚠️ RAG database skipped: connect ECONNREFUSED
```
**Solução**: Suba o PostgreSQL: `docker compose -f deploy/postgres-rag/docker-compose.yml up -d`

### CoT Routing lento

Configure `ROUTER_COT_ENABLED=false` para usar heurística instantânea.

### Bot não responde

```bash
pm2 status gueclaw-agent
pm2 logs gueclaw-agent
```

---

## 📝 Changelog

- **v2.2.0** (10/05/2026) — RAG Profundo (PostgreSQL + pgvector) + CoT Routing (7 especialistas) + 284 testes
- **v2.1.0** (22/04/2026) — Multi-LLM + Smart Routing, One-line installer
- **v2.0.0** (22/04/2026) — Error Recovery System, Continue button
- **v1.9.0** — Context Files, Cron Scheduler
- **v1.8.0** — Subagentes paralelos, DOE architecture

📖 **[CHANGELOG completo](CHANGELOG.md)**

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -m 'feat: nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- **DeepSeek** — Triage CoT + modelos de reasoning/code
- **OpenRouter** — Gateway unificado para 200+ modelos
- **pgvector** — Extensão PostgreSQL para busca vetorial
- **Grammy** — Telegram Bot Framework para Node.js
- **pdf-parse** — Extração de texto de PDFs

---

**Desenvolvido com ❤️ para automação VPS inteligente**
