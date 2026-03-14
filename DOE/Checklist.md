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
- [ ] Frontend (React + React Flow + Monaco).
- [x] API Orquestradora (CRUD + validação DAG).
- [x] Runner Sandbox (isolamento + limites).
- [x] Worker de fila (execuções e retries).
- [x] Redis (fila e locks).
- [x] Supabase (DB + Auth).
- [x] Gemini Service (geração de código + análise de logs).

## D. Segurança e Confiabilidade
- [ ] Sandbox real (gVisor/firejail) com limites CPU/memória/timeout.
- [x] Validar DAG (bloquear ciclos).
- [x] Idempotência e retries com backoff.
- [x] Segregar credenciais por workspace.
- [x] Logs com trace_id e métricas por nó.

## E. Fluxos Principais
- [ ] Geração de código: UI → Gemini → validação → salvar.
- [ ] Dry-run: UI → API → Runner → logs → Gemini sugere correções.
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
