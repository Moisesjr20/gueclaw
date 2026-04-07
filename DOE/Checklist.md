# Checklist do Projeto (com Diretivas DOE)

## A. Diretivas DOE (Obrigatórias)
- [x] Ler arquivos relacionados antes de codar.
- [x] Criar artefato "Implementation Plan" e aguardar "DE ACORDO".
- [x] Não quebrar build.
- [x] Todo PR deve ter testes.
- [x] Usar kebab-case em nomes de arquivos.
- [x] Preferir comandos: npm run test:unit, npm run test:e2e, npm run lint:fix.
- [x] Banco local em Docker Compose, nunca prod.

## B. Arquitetura Geral (VPS + EasyPanel + Supabase DB)
- [x] Definir stack do runtime (Node ou Deno).
- [x] Definir queue (Redis/BullMQ ou Postgres jobs).
- [x] Definir política de dados para Gemini (logs podem sair?).
- [x] Definir domínios (API, Frontend).

## C. Serviços
- [x] Frontend (React + React Flow + Monaco + Chat Web) ✅ COMPLETO.
  - [x] Dashboard Next.js 15 + Tailwind CSS
  - [x] React Flow para visualização de workflows (/workflows)
  - [x] Monaco Editor para edição de skills (/editor)
  - [x] Interface de chat web (/chat) com histórico e ações
  - [x] Páginas: Overview, Financeiro, Campanha, Conversas, Logs
  - [x] Deploy automático via Vercel
  - [x] API proxy para VPS
- [x] API Orquestradora (CRUD + validação DAG).
- [x] Runner Sandbox (isolamento + limites).
- [x] Worker de fila (execuções e retries).
- [x] Redis (fila e locks).
- [x] Supabase (DB + Auth).
- [x] Gemini Service (geração de código + análise de logs).

## D. Segurança e Confiabilidade
- [x] Sandbox de skills (Forked Execution com isolamento de processo) ✅ IMPLEMENTADO.
- [x] Validar DAG (bloquear ciclos).
- [x] Idempotência e retries com backoff.
- [x] Segregar credenciais por workspace.
- [x] Logs com trace_id e métricas por nó.
- [x] Auditoria de segurança completa (13/13 itens H1-H13) ✅ COMPLETO.

## x] Chat Web: UI (/chat) → API → AgentLoop/Skills → resposta → UI (tempo real) ✅ FUNCIONANDO.
- [x] Editor: UI (/editor) → carregar skill → editar Monaco → salvar → API → VPS ✅ FUNCIONANDO.
- [x] Workflows: UI (/workflows) → React Flow → visualizar execuções → auto-refresh ✅ FUNCIONANDO.
- [x] Execução via Telegram: User → Bot → Skills/Tools → Resposta ✅ FUNCIONANDO.
- [x] API Debug: /api/chat, /api/skills/*, /api/conversations/* ✅ FUNCIONANDOe correções.
- [ ] Execução: API → fila → worker → logs/output → UI.

## F. Deploy EasyPanel
- [x] Criar serviços: frontend, api, runner, worker, redis.
- [x] Variáveis de ambiente (Supabase URL/keys, Gemini API key, Redis URL).
- [x] Healthchecks e escalabilidade básica.

## G. Testes e Qualidade
- [x] Testes unitários (npm run test:unit).
- [x] Testes e2e (npm run test:e2e).
- [x] Lint (npm run lint:fix).
- [x] Nunca commitar sem testes.

---

## H. Segurança — Plano de Ação (Auditoria GueClaw vs OpenClaw)

> Origem: auditoria comparativa realizada em 2026-03-14.
> Metodologia: SAST · Input Validation · SCA · Logic Flaw Diffing · Vulnerability Profiling.

### 🔴 P0 — Crítico (resolver antes do próximo deploy)

- [x] **H1 · Command Injection — `vps-command-tool.ts`**
  - Trocar `execAsync(command)` por `execFileAsync(binary, args[], { shell: false })`
  - Implementar allowlist de binários permitidos (ls, df, ps, systemctl…)
  - Rejeitar args com metacaracteres de shell `[;&|` $<>\\()\n]`
  - Arquivo: `src/tools/vps-command-tool.ts`

- [x] **H2 · Command Injection — `docker-tool.ts`**
  - Validar `containerName` com regex `^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,253}$`
  - Validar `composePath` com `path.resolve()` + blocklist de dirs proibidos
  - Trocar template strings `docker ${cmd}` por `execFileAsync('docker', [subCmd, ...safeArgs])`
  - Arquivo: `src/tools/docker-tool.ts`

- [x] **H3 · Path Traversal — `file-operations-tool.ts`**
  - Criar variável `WORKSPACE_ROOT` via `process.env.FILE_WORKSPACE_ROOT`
  - Implementar `assertSafePath(filePath)` → `path.resolve()` + verificação de prefixo
  - Aplicar `assertSafePath` em **todas** as operações: read, write, append, delete, list_dir
  - Arquivo: `src/tools/file-operations-tool.ts`

- [x] **H4 · SSRF — `api-request-tool.ts`**
  - Implementar `assertSafeUrl(url)` com blocklist RFC1918 + link-local (`169.254.x.x`)
  - Resolver DNS do hostname e re-validar o IP resultante antes da requisição
  - Rejeitar protocolos fora de `http:` / `https:`
  - Arquivo: `src/tools/api-request-tool.ts`

---

### 🟠 P1 — Alto (resolver esta semana)

- [x] **H5 · Token leak em logs — `api-request-tool.ts`**
  - Criar `maskSensitiveUrl(url)` com regex `/\/bot\d+:[A-Za-z0-9_-]+\//g → /bot[REDACTED]/`
  - Substituir `console.log(\`Making ${method} request to ${url}\`)` pela versão mascarada
  - Arquivo: `src/tools/api-request-tool.ts`

- [x] **H6 · Path Traversal via userId — `persistent-memory.ts`**
  - Criar `assertSafeUserId(userId)` com regex `/^\d{1,20}$/`
  - Aplicar no método `dir(userId)` antes de `path.join(BASE_DIR, userId)`
  - Arquivo: `src/core/memory/persistent-memory.ts`

---

### 🟡 P2 — Médio (resolver este mês)

- [x] **H7 · Senha root VPS em plaintext — `.env`**
  - Instruções SSH key adicionadas como comentário no `.env`
  - `VPS_SSH_KEY_PATH=` adicionado (preencher após gerar a chave)

- [x] **H8 · Fail-hard em whitelist Telegram vazia — `src/index.ts`**
  - Em `validateEnvironment()`, após checar `TELEGRAM_ALLOWED_USER_IDS`, validar que há pelo menos 1 ID numérico válido
  - Chamar `process.exit(1)` com mensagem clara se a lista estiver vazia ou malformada
  - Arquivo: `src/index.ts`

---

### 🔵 P3 — Hardening adicional (backlog)

- [x] **H9** · `scripts/check-secrets.js` criado + `npm run secrets:scan` em `package.json` — escaneia `src/` e `scripts/` por credenciais hardcoded
- [x] **H10** · `tests/unit/security-validators.test.ts` criado — 45 testes cobrindo `assertSafeCommand`, `assertSafePath` (denylist + WORKSPACE_ROOT), `assertSafeUrl` (SSRF + protocolo) e `assertSafeUserId`; `persistent-memory.test.ts` atualizado para IDs numéricos
- [x] **H11** · `FILE_WORKSPACE_ROOT=/opt/gueclaw-agent` adicionado ao `.env`; `FILE_WORKSPACE_ROOT=/opt/gueclaw-agent/workspace` adicionado ao `.env.example`; variável lida dinamicamente em `assertSafePath` (não mais módulo-level)
- [x] **H12** · `console.log` de comando VPS encapsulado em `if (LOG_LEVEL === 'debug')` em `vps-command-tool.ts`
- [x] **H13** · Credencial `VPS_PASSWORD` removida de **6 scripts** (`deploy.js`, `restart-bot.js`, `check-logs.js`, `check-logs-detailed.js`, `reset-and-auth.js`, `auth-copilot-remote.js`) — substituída por `process.env.VPS_PASSWORD` via `dotenv`; guard `if (!VPS_PASSWORD) process.exit(1)` adicionado em cada um

---

## I. Dashboard Web (Vercel + Next.js 15) ✅ COMPLETO

### Frontend Completo
- [x] **Página /overview** — Status PM2, estatísticas de skills, processos ativos
- [x] **Página /chat** — Interface de chat web com GueClaw, histórico, indicador de ações
- [x] **Página /workflows** — React Flow para visualização de execução de skills/tools
- [x] **Página /editor** — Monaco Editor para editar prompts e testar skills
- [x] **Página /financeiro** — Controle financeiro com password protection
- [x] **Página /campaign** — Monitoramento de campanha WhatsApp
- [x] **Página /conversations** — Histórico de conversas
- [x] **Página /logs** — Visualização de logs PM2

### Bibliotecas e Integração
- [x] **@xyflow/react** v12 — React Flow para workflows
- [x] **@monaco-editor/react** v4 — Editor de código profissional
- [x] **SWR** — Data fetching com auto-refresh
- [x] **Tailwind CSS** — Estilização glass morphism
- [x] **Next.js proxy** — `/api/[...path]` redireciona para VPS

### API Endpoints (Debug API)
- [x] GET `/api/health` — Health check
- [x] GET `/api/conversations` — Lista conversas
- [x] GET `/api/conversations/:id/messages` — Mensagens de conversa
- [x] GET `/api/chat/messages/:id` — Mensagens formatadas para UI
- [x] POST `/api/chat` — Enviar mensagem (chat web)
- [x] GET `/api/stats` — Estatísticas de skills
- [x] GET `/api/pm2/status` — Status de processos PM2
- [x] GET `/api/campaign` — Stats de campanha
- [x] GET `/api/financial/balance` — Saldo financeiro
- [x] GET `/api/logs/tail` — Últimas linhas de log
- [x] GET `/api/skills` — Lista de skills disponíveis
- [x] GET `/api/skills/executions/recent` — Execuções recentes (workflows)
- [x] GET `/api/skills/files/:skillName` — Conteúdo de skill (editor)
- [x] POST `/api/skills/files/:skillName` — Salvar skill editada
- [x] POST `/api/skills/execute` — Executar skill (teste)
- [x] POST `/api/simulate` — Simular mensagem (debug)

---

## J. O que falta (além de testes) ⏳ OPCIONAL

### Melhorias Opcionais (não críticas para 100%)
- [ ] **WebSocket real-time** — Substituir polling por WebSocket no chat
- [ ] **Upload de arquivos** — Anexar arquivos nas conversas web
- [ ] **Markdown rendering** — Syntax highlighting no chat web
- [ ] **Export de conversas** — PDF, Markdown, JSON
- [ ] **Busca no histórico** — Full-text search em conversas
- [ ] **Tags/categorias** — Organizar conversas por projeto
- [ ] **Notificações** — Push notifications para eventos importantes
- [ ] **Multi-usuário** — Sistema de permissões e workspaces
- [ ] **Analytics dashboard** — Gráficos de uso, custos, performance
- [ ] **Voice input web** — Gravação de voz no chat web
- [ ] **Dark/Light theme** — Alternar entre temas

### Documentação Pendente
- [ ] **README completo** — Atualizar com todas as features
- [ ] **Guia do usuário** — Como usar o dashboard
- [ ] **API docs** — Documentação swagger/openAPI
- [ ] **Skills catalog** — Catálogo visual de skills disponíveis
- [ ] **Troubleshooting guide** — FAQ e resolução de problemas

### Otimizações Futuras
- [ ] **Cache Redis** — Cachear respostas frequentes
- [ ] **Rate limiting** — Proteção contra abuse
- [ ] **CDN** — Servir assets estáticos via CDN
- [ ] **Lazy loading** — Carregar componentes sob demanda
- [ ] **Service Worker** — PWA com offline support
- [ ] **Performance monitoring** — APM (Application Performance Monitoring)

---

**NOTA:** O projeto está **98-100% completo** para MVP. As melhorias acima são refinamentos opcionais que podem ser implementados conforme demanda.
