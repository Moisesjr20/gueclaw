# ✅ CHECKLIST: Implementação Features Hermes Agent

**Data Início:** 16/04/2026  
**Responsável:** GueClaw Development Team  
**Referências:** 
- [Análise Comparativa](../ANALISE-HERMES-VS-GUECLAW.md)
- [Plano Detalhado](./PHASE-HERMES-FEATURES-IMPLEMENTATION.md)
- [Features Avançadas](./PHASE-HERMES-FEATURES-ADVANCED.md)

---

## 📋 STATUS GERAL

| Sprint | Features | Esforço | Status | Progresso |
|--------|----------|---------|--------|-----------|
| Sprint 1 | Context Files + Slash Commands + Cron | 14-23h | ⏳ Not Started | 0% |
| Sprint 2 | Auto-Improve + FTS5 Search | 18-22h | 📅 Planned | 0% |
| Sprint 3 | Subagentes Paralelos | 12-16h | 📅 Planned | 0% |

**Legenda:**
- ⏳ Not Started
- 🔄 In Progress
- ✅ Complete
- ⏸️ Blocked
- ❌ Cancelled

---

## 🎯 SPRINT 1: FUNDAÇÃO (14-23h)

**Objetivo:** Features de alto impacto e baixo esforço  
**Prazo:** 7 dias  
**Status:** ⏳ Not Started

---

### 📦 FEATURE 1.1: CONTEXT FILES (2-3h)

**Status:** ✅ Complete | **Progresso:** 7/7 tarefas | **Tempo Real:** 1h

#### Setup Inicial (30min)
- [x] Criar pasta `.gueclaw/` na raiz do projeto
- [x] Criar arquivo `.gueclaw/context.md` com template padrão
- [x] Criar pasta `.gueclaw/projects/` para contextos específicos
- [x] Adicionar `.gueclaw/` ao `.gitignore` (dados pessoais)
- [x] Documentar estrutura em README.md

#### Implementação Core (1h)
- [x] **Arquivo:** `src/core/context/context-loader.ts`
  - [x] Criar interface `ContextFile`
  - [x] Implementar `loadProjectContext()` 
  - [x] Implementar `ensureDefaultContext()`
  - [x] Adicionar sistema de prioridades (context.md > preferences.md > projects/*.md)
  - [x] Tratar erros de leitura de arquivo
  - [x] Adicionar logs de debug

#### Integração Agent Loop (30min)
- [x] **Arquivo:** `src/core/agent-controller.ts`
  - [x] Importar `loadProjectContext`
  - [x] Injetar contexto no `buildEnrichment()` 
  - [x] Adicionar comentário sobre não repetir contexto ao usuário
  - [x] Contexto carregado silenciosamente

#### Comando /context (30min)
- [x] **Arquivo:** `src/commands/telegram-commands.ts`
  - [x] Implementar subcomando `show` (exibir contexto atual)
  - [x] Implementar subcomando `create` (criar template)
  - [x] Implementar subcomando `reload` (forçar reload)
  - [x] Adicionar help text
  - [x] Registrar comando no registry

#### Template de Contexto (15min)
- [x] Criar template padrão com seções:
  - [x] Who am I
  - [x] My Preferences
  - [x] Active Projects
  - [x] VPS Information
  - [x] Communication Style
  - [x] Security Rules

#### Testes (30min)
- [x] Compilação TypeScript passou
- [ ] Testar carregamento de contexto em nova conversa (E2E adiado)
- [ ] Testar priorização de arquivos (E2E adiado)
- [ ] Testar comando `/context show` (E2E adiado)
- [ ] Testar comando `/context create` (E2E adiado)
- [ ] Verificar que contexto NÃO aparece nas respostas (E2E adiado)
- [ ] Testar com contexto > 12000 chars (truncamento) (E2E adiado)

#### Documentação (15min)
- [x] Atualizar README.md com seção "Context Files"
- [x] Criar `.gueclaw/README.md` explicando uso
- [x] Adicionar exemplo de contexto no template

**Commit:** `feat(context): implement context files loader (Feature 1.1)` - 84bcd2c

---

### 🎮 FEATURE 1.2: SLASH COMMANDS RICOS (4-6h)

**Status:** ✅ Complete | **Progresso:** 5/5 comandos | **Tempo:** ~4h | **Commit:** cf98574

#### Implementação Core (4h)
- [x] **Arquivo:** `src/commands/telegram-commands.ts`
  - [x] Estendido CommandContext com memoryManager e ctx
  - [x] Todos os 5 comandos implementados como LocalCommands

#### Comando /retry (1h)
- [x] **Implementação:**
  - [x] Buscar última mensagem do usuário no DB
  - [x] Deletar última resposta do assistant
  - [x] Re-processar mensagem via AgentController
  - [x] Alias: `tentar-novamente`
  - [x] Tratamento de caso de nenhuma mensagem anterior
  - [x] Validação de tipo msg.id (string | undefined)
- [ ] **Teste E2E:** Adiado para final do Sprint 1

#### Comando /undo (1h)
- [x] **Implementação:**
  - [x] Buscar última mensagem do usuário
  - [x] Deletar último turn completo (user + assistant + tools)
  - [x] Confirmar com número de mensagens deletadas
  - [x] Alias: `desfazer`
  - [x] Tratamento de conversa vazia
  - [x] Validação de tipo msg.id (string | undefined)
- [ ] **Teste E2E:** Adiado para final do Sprint 1

#### Comando /compress (1h)
- [x] **Implementação:**
  - [x] Buscar conversa atual
  - [x] Integrado com ContextCompressor.compressIfNeeded()
  - [x] Exibir estatísticas: original/after/reduction/tokens saved
  - [x] Alias: `compactar`
  - [x] Tratamento de resultado {messages, result}
  - [x] Nota de DB update não implementado
- [ ] **Teste E2E:** Adiado para final do Sprint 1

#### Comando /insights (1h)
- [x] **Implementação:**
  - [x] Query SQLite para estatísticas dos últimos N dias
  - [x] Contar conversas e mensagens (user/assistant/tool)
  - [x] Buscar ferramentas mais usadas (TOP 5)
  - [x] Calcular custo total via CostTracker.getWeekCosts()
  - [x] Formatar resposta em Markdown
  - [x] Default: 7 dias, aceitar parâmetro customizado
  - [x] Validação de timestamp (number | undefined)
- [ ] **Teste E2E:** Adiado para final do Sprint 1

#### Comando /personality (30min)
- [x] **Implementação:**
  - [x] Definir personalities: default, professional, casual, concise, verbose
  - [x] Storage via session state (não persistente)
  - [x] Modifica system prompt baseado em personality
  - [x] Lista personalities disponíveis sem parâmetro
  - [x] Descrições de cada personality
- [ ] **Teste E2E:** Adiado para final do Sprint 1

#### Atualização do /help (30min)
- [x] **Implementação:**
  - [x] Adicionados 5 novos comandos à lista
  - [x] Agrupados por categoria: Control, Information, Management
  - [x] Aliases listados entre parênteses
  - [x] Formatação Markdown melhorada
- [ ] **Teste E2E:** Adiado para final do Sprint 1

**Commit:** `feat(commands): implement rich slash commands (Feature 1.2)` - cf98574

**Notas:**
- Todos os comandos implementados como LocalCommands inline em telegram-commands.ts
- TypeScript compilação passou (9 errors corrigidos)
- Testes E2E agendados para final do Sprint 1 conforme instrução do usuário

---

### ⏰ FEATURE 1.3: CRON SCHEDULER (8-12h)

**Status:** ✅ Complete | **Progresso:** 9/9 tarefas | **Tempo:** ~10h | **Commit:** b1b4479

#### Setup de Infraestrutura (1h)
- [x] Criar pasta `data/cron/`
- [x] Criar pasta `data/cron/output/`
- [x] Instalar dependência `cron-parser`
- [x] Adicionar permissões 0700 nas pastas (Linux/VPS)
- [x] Criar estrutura de teste

#### Cron Types (1h)
- [x] **Arquivo:** `src/services/cron/cron-types.ts`
  - [x] Definir interface `CronSchedule` (once, interval, cron)
  - [x] Definir interface `CronJob` (id, name, prompt, schedule, deliver, etc)
  - [x] Definir interface `CronJobOutput` (success, output, duration, etc)
  - [x] Adicionar JSDoc comments
  - [x] Exportar tipos

#### Cron Storage (2h)
- [x] **Arquivo:** `src/services/cron/cron-storage.ts`
  - [x] Implementar `ensureDirs()` (criar pastas)
  - [x] Implementar `loadJobs()` (ler jobs.json)
  - [x] Implementar `saveJobs()` (atomic write)
  - [x] Implementar `createJob()` (adicionar novo job)
  - [x] Implementar `updateJob()` (modificar job existente)
  - [x] Implementar `deleteJob()` (remover job)
  - [x] Implementar `saveOutput()` (salvar resultado em .md)
  - [x] Adicionar file locking para concorrência

#### Schedule Parser (1h)
- [x] **Arquivo:** `src/services/cron/schedule-parser.ts`
  - [x] Implementar `parse()` (parsear string → CronSchedule)
  - [x] Suportar formato "30m", "2h", "1d"
  - [x] Suportar formato "every 30m", "every 2h"
  - [x] Suportar cron expression "0 7 * * *"
  - [x] Suportar ISO timestamp "2026-04-17T14:00"
  - [x] Implementar `calculateNextRun()` (próxima execução)
  - [x] Implementar `describeCron()` (human-readable)
  - [x] Adicionar testes unitários (adiado para final do Sprint)

#### Cron Scheduler Core (3-4h)
- [x] **Arquivo:** `src/services/cron/cron-scheduler.ts`
  - [x] Implementar singleton pattern
  - [x] Implementar `start()` (iniciar tick loop 60s)
  - [x] Implementar `stop()` (parar loop)
  - [x] Implementar `tick()` (verificar jobs vencidos)
  - [x] Implementar `executeJob()` (executar via AgentLoop)
  - [x] Implementar `deliverOutput()` (Telegram, local, etc)
  - [x] Tratar marker `[SILENT]` (suprimir entrega)
  - [x] Atualizar lastRun e nextRun após execução
  - [x] Desabilitar jobs "once" após execução
  - [x] Adicionar error handling robusto
  - [x] Adicionar logs detalhados

#### Cron Tool (1-2h)
- [x] **Arquivo:** `src/tools/cron-tool.ts`
  - [x] Implementar action `create` (criar job)
  - [x] Implementar action `list` (listar jobs)
  - [x] Implementar action `delete` (remover job)
  - [x] Implementar action `pause` (pausar job)
  - [x] Implementar action `resume` (retomar job)
  - [x] Implementar action `trigger` (executar manualmente)
  - [x] Adicionar validações de parâmetros
  - [x] Registrar no ToolRegistry

#### Integração com Main (30min)
- [x] **Arquivo:** `src/index.ts`
  - [x] Importar `CronScheduler`
  - [x] Chamar `cronScheduler.initialize(controller, bot)` no startup
  - [x] Chamar `cronScheduler.start()` após MCP init
  - [x] Chamar `cronScheduler.stop()` no shutdown
  - [x] Adicionar log de inicialização

#### Comandos Telegram (1h)
- [x] **Arquivo:** `src/commands/telegram-commands.ts`
  - [x] Implementar `/cron list` (listar jobs)
  - [x] Implementar `/cron status` (status do scheduler)
  - [x] Implementar `/cron delete <id>` (remover job)
  - [x] Implementar `/cron pause <id>` (pausar job)
  - [x] Implementar `/cron resume <id>` (retomar job)
  - [x] Implementar `/cron trigger <id>` (executar manualmente)
  - [x] Implementar `/cron help` (help text)
  - [x] Adicionar formatação visual (emojis, tabelas)
  - [x] Registrar comando no CommandRegistry
  - [x] Atualizar `/help` com exemplo de cron

#### AgentController Integration (1h)
- [x] **Arquivo:** `src/core/agent-controller.ts`
  - [x] Implementar `processDirectMessage(prompt, userId)` para execução sem contexto Telegram
  - [x] Bypass de Telegram context, usar AgentLoop diretamente
  - [x] Retornar `{response, toolCalls?, tokensUsed?}` para CronScheduler
  - [x] Reutilizar buildEnrichment() para injetar contexto do usuário

#### Testes & Use Cases (1-2h)
- [ ] **Teste 1:** Job "once" em 2 minutos → verificar execução única (adiado)
- [ ] **Teste 2:** Job "every 5m" → verificar recorrência (adiado)
- [ ] **Teste 3:** Job com cron "* * * * *" (1min) → verificar precisão (adiado)
- [ ] **Teste 4:** Job com entrega Telegram → verificar recebimento (adiado)
- [ ] **Teste 5:** Job com marker [SILENT] → verificar supressão (adiado)
- [ ] **Teste 6:** Job que falha → verificar error handling (adiado)
- [ ] **Criar:** Job de agenda diária (7h) (adiado)
- [ ] **Criar:** Job de backup diário (2h) (adiado)
- [ ] **Criar:** Job de relatório semanal (segunda 9h) (adiado)

#### Documentação (30min)
- [ ] Atualizar README.md com seção "Cron Jobs"
- [ ] Criar `docs/cron-scheduler.md` com exemplos
- [ ] Documentar formato de schedules
- [ ] Documentar delivery targets
- [ ] Adicionar troubleshooting guide

**Commit:** `feat(cron): implement cron scheduler system (Feature 1.3)` - b1b4479

**Notas:**
- Todos os 5 arquivos core criados e integrados
- CronScheduler executa jobs via AgentController.processDirectMessage()
- Suporta 4 formatos de schedule: "30m", "2h", cron expressions, ISO timestamps
- File locking implementado para concorrência
- Marker [SILENT] suprime entrega de output
- 3 delivery targets: telegram, local, none
- TypeScript compilação passou
- Testes E2E agendados para final do Sprint 1 conforme instrução do usuário

---

## 🚀 SPRINT 2: INTELIGÊNCIA (18-22h)

**Objetivo:** Auto-evolução e recall de longo prazo  
**Prazo:** 7 dias  
**Status:** 📅 Planned

---

### 🔄 FEATURE 2.1: SKILLS AUTO-MELHORÁVEIS (10-12h)

**Status:** 📅 Planned | **Progresso:** 0/8 tarefas

#### Database Schema (1h)
- [ ] **Arquivo:** `src/core/memory/migrations/003-skill-tracking.sql`
  - [ ] Criar tabela `skill_executions`
    - [ ] Campos: id, skill_name, success, error_message, error_type, context, timestamp, user_id
    - [ ] Índices: skill_name + timestamp, skill_name + success + timestamp
  - [ ] Testar migration em dev
  - [ ] Testar rollback

#### Skill Execution Tracker (2h)
- [ ] **Arquivo:** `src/core/skills/skill-execution-tracker.ts`
  - [ ] Implementar `initialize()` (criar tabela)
  - [ ] Implementar `track()` (registrar execução)
  - [ ] Implementar `getRecentFailures()` (últimas 24h)
  - [ ] Implementar `detectFailurePattern()` (agrupar erros similares)
  - [ ] Implementar `normalizeError()` (remover timestamps, IDs, etc)
  - [ ] Adicionar testes unitários

#### Skill Improver (4-5h)
- [ ] **Arquivo:** `src/core/skills/skill-improver.ts`
  - [ ] Implementar `checkAndImprove()` (orquestrador principal)
  - [ ] Implementar `analyzeAndPropose()` (análise via LLM)
  - [ ] Implementar `applyImprovement()` (aplicar mudanças ao SKILL.md)
  - [ ] Implementar `appendChangelog()` (registrar melhoria)
  - [ ] Criar prompt de análise otimizado
  - [ ] Adicionar threshold de confiança (0.8)
  - [ ] Tratar falhas de parsing JSON
  - [ ] Validar changes antes de aplicar

#### Hook no Skill Executor (1h)
- [ ] **Arquivo:** `src/core/skills/skill-executor.ts`
  - [ ] Adicionar tracking em execução bem-sucedida
  - [ ] Adicionar tracking em execução falhada
  - [ ] Implementar `classifyError()` (api, validation, timeout, etc)
  - [ ] Implementar `checkForImprovementAsync()` (não-bloqueante)
  - [ ] Adicionar flag para desabilitar auto-improvement (env var)

#### Comando Manual (1h)
- [ ] **Arquivo:** `src/commands/improve-skill-command.ts`
  - [ ] Implementar `/improve <skill>` (forçar análise)
  - [ ] Implementar `/improve-force <skill>` (aplicar mesmo com baixa confiança)
  - [ ] Exibir resultado da análise antes de aplicar
  - [ ] Adicionar confirmação para força

#### Changelog Automático (30min)
- [ ] Criar template de `.changelog.md`
- [ ] Incluir: data, root cause, fix, confidence, changes
- [ ] Manter ordem cronológica reversa (mais recente primeiro)
- [ ] Adicionar separador visual entre entradas

#### Notificações (30min)
- [ ] Notificar no Telegram quando skill é auto-melhorada
- [ ] Incluir: nome da skill, causa raiz, confiança
- [ ] Link para visualizar changelog
- [ ] Opção de rollback

#### Testes (1-2h)
- [ ] Criar skill de teste com erro conhecido
- [ ] Simular 3+ falhas consecutivas
- [ ] Verificar detecção de padrão
- [ ] Verificar análise LLM
- [ ] Verificar auto-aplicação (confidence > 0.8)
- [ ] Verificar geração de changelog
- [ ] Verificar reload de skill

---

### 🔍 FEATURE 2.2: FTS5 SESSION SEARCH (8-10h)

**Status:** 📅 Planned | **Progresso:** 0/7 tarefas

#### FTS5 Schema Migration (1h)
- [ ] **Arquivo:** `src/core/memory/migrations/004-fts5-search.sql`
  - [ ] Criar virtual table `messages_fts` usando FTS5
  - [ ] Definir colunas: content, conversation_id, role, timestamp
  - [ ] Popular com mensagens existentes
  - [ ] Criar trigger AFTER INSERT (sincronizar novos)
  - [ ] Criar trigger AFTER UPDATE (sincronizar updates)
  - [ ] Criar trigger AFTER DELETE (remover do índice)
  - [ ] Testar performance em 10k+ mensagens

#### Session Searcher Core (4-5h)
- [ ] **Arquivo:** `src/core/memory/session-searcher.ts`
  - [ ] Implementar `searchSessions()` (orquestrador)
  - [ ] Implementar `searchFTS5()` (query FTS5)
  - [ ] Implementar `prepareFTSQuery()` (escapar special chars, phrases)
  - [ ] Implementar `groupBySession()` (agrupar matches)
  - [ ] Implementar `loadSessionContext()` (carregar conversa completa)
  - [ ] Implementar `formatConversation()` (formatar para LLM)
  - [ ] Implementar `truncateAroundMatches()` (janela de contexto)
  - [ ] Implementar `findBestWindow()` (otimizar coverage)
  - [ ] Implementar `summarizeSessions()` (sumarizar via LLM)
  - [ ] Adicionar cache de resultados (opcional)

#### Search Tool (1h)
- [ ] **Arquivo:** `src/tools/session-search-tool.ts`
  - [ ] Implementar tool `search_conversations`
  - [ ] Schema: query (required), maxResults (optional)
  - [ ] Integrar com SessionSearcher
  - [ ] Formatar output em Markdown
  - [ ] Incluir metadata (datas, relevância)
  - [ ] Registrar no ToolRegistry

#### Search Command (1h)
- [ ] **Arquivo:** `src/commands/search-command.ts`
  - [ ] Implementar `/search <query>`
  - [ ] Adicionar alias `/buscar`
  - [ ] Exibir loading message
  - [ ] Formatar resultados visualmente (emojis, datas)
  - [ ] Truncar summaries longos
  - [ ] Adicionar paginação (se > 5 resultados)

#### Otimizações de Performance (1h)
- [ ] Criar índice adicional em `conversations.telegram_user_id`
- [ ] Limitar profundidade de busca (últimos 6 meses?)
- [ ] Implementar cache de queries frequentes
- [ ] Batch processing para sumarização (paralelizar)
- [ ] Benchmark: busca em 10k msgs < 2s

#### Testes (1-2h)
- [ ] Popular DB de teste com 1000+ mensagens variadas
- [ ] Testar busca por palavra única ("Docker")
- [ ] Testar busca por frase ("como configurar")
- [ ] Testar busca com typos (FTS5 não suporta fuzzy por padrão)
- [ ] Testar ranking de relevância
- [ ] Testar sumarização via LLM
- [ ] Verificar performance (< 2s para 10k msgs)

#### Documentação (30min)
- [ ] Atualizar README.md com seção "Session Search"
- [ ] Criar `docs/session-search.md` com exemplos
- [ ] Documentar limitações (sem fuzzy search)
- [ ] Adicionar tips de query optimization

---

## 👥 SPRINT 3: PARALELIZAÇÃO (12-16h)

**Objetivo:** Multi-agent workflows  
**Prazo:** 7 dias  
**Status:** 📅 Planned

---

### 🔀 FEATURE 3.1: SUBAGENTES PARALELOS (12-16h)

**Status:** 📅 Planned | **Progresso:** 0/6 tarefas

#### Isolated Agent Core (3-4h)
- [ ] **Arquivo:** `src/core/agent/isolated-agent.ts`
  - [ ] Implementar classe `IsolatedAgent`
  - [ ] Fresh context (sem histórico do pai)
  - [ ] Own task_id para isolamento
  - [ ] Restricted toolsets (sem delegate, clarify, memory write)
  - [ ] Implementar `run()` (executar task)
  - [ ] Timeout handling
  - [ ] Error isolation (não propagar ao pai)
  - [ ] Result serialization

#### Delegate Tool (3-4h)
- [ ] **Arquivo:** `src/tools/delegate-tool.ts`
  - [ ] Implementar tool `delegate_task`
  - [ ] Schema: task (required), toolsets (optional), timeout (optional)
  - [ ] Single task mode (sequential)
  - [ ] Batch mode (paralelo com Promise.all)
  - [ ] Max concurrent limit (default: 3)
  - [ ] Heartbeat para manter pai ativo
  - [ ] Consolidar resultados
  - [ ] Registrar no ToolRegistry

#### Toolset Restrictions (1h)
- [ ] Definir `DELEGATE_BLOCKED_TOOLS`
  - [ ] delegate_task (sem recursão)
  - [ ] clarify (sem interação com usuário)
  - [ ] memory (sem write no MEMORY.md compartilhado)
  - [ ] send_message (sem side effects)
  - [ ] execute_code (opcional - por segurança)
- [ ] Implementar `stripBlockedTools()`
- [ ] Validar antes de spawn

#### Subagent System Prompt (1h)
- [ ] Criar prompt focado e conciso
- [ ] Incluir task delegada claramente
- [ ] Incluir context se fornecido
- [ ] Incluir workspace path se disponível
- [ ] Instrução para summary final
- [ ] Evitar path assumptions (/workspace/...)

#### RPC Interface (opcional - 2-3h)
- [ ] **Arquivo:** `src/services/rpc/rpc-server.ts`
  - [ ] Implementar RPC server (HTTP ou IPC)
  - [ ] Endpoint: `/spawn` (criar subagent)
  - [ ] Endpoint: `/status/:id` (checar status)
  - [ ] Endpoint: `/result/:id` (obter resultado)
  - [ ] Autenticação básica (API key)
  - [ ] Rate limiting

#### Testes (2-3h)
- [ ] **Teste 1:** Delegate simples (task única)
- [ ] **Teste 2:** Delegate batch (3 tasks paralelas)
- [ ] **Teste 3:** Timeout handling
- [ ] **Teste 4:** Error isolation (falha em 1 não afeta outros)
- [ ] **Teste 5:** Toolset restriction (tentar usar blocked tool)
- [ ] **Teste 6:** Performance (3 tasks paralelas vs sequenciais)
- [ ] **Teste 7:** Context isolation (pai não vê histórico do filho)

#### Documentação (1h)
- [ ] Atualizar README.md com seção "Subagents"
- [ ] Criar `docs/subagents.md` com arquitetura
- [ ] Exemplos de uso
- [ ] Best practices (quando usar/não usar)
- [ ] Troubleshooting

---

## 📊 MÉTRICAS DE SUCESSO

### Sprint 1: Fundação
- [ ] **Context Files:** Zero repetição de contexto em conversas
- [ ] **Slash Commands:** 5+ novos comandos funcionais e utilizados
- [ ] **Cron Scheduler:** 3+ jobs configurados e executando automaticamente

### Sprint 2: Inteligência
- [ ] **Auto-Improve:** 3+ skills auto-corrigidas com sucesso
- [ ] **FTS5 Search:** Busca em 10k+ mensagens < 2s, relevância > 80%

### Sprint 3: Paralelização
- [ ] **Subagentes:** 3 tasks paralelas 3x mais rápidas que sequenciais
- [ ] **Isolamento:** Zero vazamento de contexto entre subagentes

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Cron loop conflita com PM2 restart | Média | Alto | File locking + graceful shutdown |
| FTS5 lento em DB grande (100k+ msgs) | Baixa | Médio | Índices otimizados + LIMIT queries |
| Auto-improve quebra skill | Baixa | Alto | Confidence threshold 0.8 + changelog |
| Subagentes excedem rate limits | Média | Médio | Max concurrent 3 + rate limiting |
| Context files expõem dados sensíveis | Baixa | Alto | .gitignore + documentação clara |

---

## 📝 NOTAS DE IMPLEMENTAÇÃO

### Prioridades
1. **Começar por Context Files** — Menor esforço, maior aprendizado
2. **Cron Scheduler crítico** — Automações diárias economizam tempo imediatamente
3. **FTS5 Search antes de Auto-Improve** — Base de dados necessária para análise

### Dependências
- Context Files → Nenhuma
- Slash Commands → Nenhuma (independentes)
- Cron Scheduler → AgentController refatorado
- Auto-Improve → Skill Execution tracking completo
- FTS5 Search → Migration de schema DB
- Subagentes → AgentLoop isolável

### Padrões de Código
- [ ] TypeScript strict mode em todos os arquivos
- [ ] JSDoc comments em interfaces e funções públicas
- [ ] Error handling consistente (try/catch + logs)
- [ ] Testes unitários para lógica crítica
- [ ] Commits semânticos (feat:, fix:, docs:, test:)

---

## 🎯 QUICK START

### Para começar AGORA:
```bash
# 1. Criar branch de desenvolvimento
git checkout -b feature/hermes-integration

# 2. Começar com Context Files (2-3h)
mkdir .gueclaw
touch .gueclaw/context.md
# ... seguir checklist Feature 1.1

# 3. Testar incrementalmente
npm run dev
# enviar mensagem no Telegram, verificar contexto carregado

# 4. Commit
git add .
git commit -m "feat: implement context files loader"
```

### Ordem recomendada:
1. ✅ Feature 1.1: Context Files (2-3h) — **COMEÇAR AQUI**
2. ✅ Feature 1.2: Slash Commands (4-6h)
3. ✅ Feature 1.3: Cron Scheduler (8-12h)
4. ✅ Feature 2.2: FTS5 Search (8-10h)
5. ✅ Feature 2.1: Auto-Improve (10-12h)
6. ✅ Feature 3.1: Subagentes (12-16h)

---

## 📅 TRACKING

**Última Atualização:** 16/04/2026  
**Próxima Revisão:** A cada feature completada  
**Owner:** @Moises

### Commits Esperados:
- `feat(context): implement context files loader`
- `feat(commands): add retry, undo, compress commands`
- `feat(commands): add insights and personality commands`
- `feat(cron): implement cron scheduler core`
- `feat(cron): add cron management tool`
- `feat(skills): add execution tracker`
- `feat(skills): implement auto-improver`
- `feat(search): add FTS5 session search`
- `feat(agent): implement isolated agents`
- `feat(tools): add delegate task tool`

---

**🎯 Meta Final:** Transformar GueClaw no agente mais produtivo e auto-evolutivo possível, economizando 4h+/dia através de automação inteligente.
