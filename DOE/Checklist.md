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
