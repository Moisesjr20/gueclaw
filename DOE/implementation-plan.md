# Implementation Plan — FluxoHub (MVP)

## 1) Objetivo desta fase
Entregar um MVP funcional de orquestração "code-first" com Supabase como backend principal, cobrindo:
- Modelagem relacional (`workflows`, `nodes`, `edges`, `executions`, `execution_logs`) com RLS.
- Conversão de dados Supabase ⇄ React Flow.
- Edge Function de orquestração para execução de nós em ordem topológica.
- Prompt de sistema para Gemini gerar código compatível com Deno/Supabase Edge Functions.

## 2) Escopo do MVP (Fase 1)
### Incluído
1. Estrutura inicial do projeto (`frontend` + `supabase/functions` + `docs`).
2. SQL de schema, índices, triggers e policies RLS.
3. Utilitários de mapeamento React Flow (`toReactFlowNodes`, `toReactFlowEdges`) com tipagem.
4. Edge Function `orchestrate-workflow` com:
   - leitura de nós/arestas do workflow,
   - validação básica de DAG,
   - execução sequencial por ordem topológica,
   - retorno de `output` consolidado.
5. Documento/prompt Gemini para geração de `code` dos nós.
6. Testes unitários do core de orquestração (ordenação topológica e detecção de ciclo).

### Fora do escopo nesta fase
- Sandbox avançado (gVisor/firejail).
- Fila distribuída (Redis/BullMQ) e worker completo.
- Editor visual completo com Monaco e UX final.
- Testes e2e ponta a ponta de UI.

## 3) Entregáveis técnicos
1. `supabase/migrations/0001_init_fluxohub.sql`
2. `supabase/functions/orchestrate-workflow/index.ts`
3. `frontend/src/lib/react-flow-mappers.ts`
4. `docs/gemini-system-prompt.md`
5. `orchestrator-core` (módulo utilitário testável) + testes unitários
6. Scripts NPM com comandos:
   - `npm run test:unit`
   - `npm run test:e2e`
   - `npm run lint:fix`

## 4) Estratégia de implementação
1. Inicializar monorepo mínimo (workspace packages: `frontend` e `orchestrator-core`).
2. Implementar e validar schema Supabase.
3. Implementar núcleo determinístico de grafo em módulo testável:
   - `buildTopologicalOrder`
   - `detectCycle`
4. Integrar núcleo na Edge Function.
5. Implementar mapeadores React Flow no frontend.
6. Adicionar prompt Gemini e documentação de contrato JSON.
7. Rodar lint + testes unitários e registrar output.

## 5) Critérios de aceite (DEFINITION OF DONE)
- Build sem quebra.
- Testes unitários passando via `npm run test:unit`.
- Lint executado via `npm run lint:fix`.
- SQL aplicável no Supabase local.
- Edge Function executa workflow acíclico e rejeita workflow cíclico.
- Mapeadores geram formato válido para React Flow.

## 6) Riscos e mitigação
- **Risco:** execução dinâmica de código dos nós com `new Function`.
  - **Mitigação (fase 1):** escopo controlado + validação estrita de entrada/saída + documentação de risco.
- **Risco:** divergência entre estado visual e banco.
  - **Mitigação:** mapeadores tipados + contrato de persistência único.
- **Risco:** crescimento de complexidade sem fila/sandbox.
  - **Mitigação:** manter arquitetura preparada para worker/queue na Fase 2.

## 7) Sequência após aprovação
Após seu "DE ACORDO", executo nesta ordem:
1. Scaffold da estrutura inicial.
2. SQL de migração Supabase.
3. Núcleo de orquestração + testes unitários.
4. Edge Function.
5. Mapeadores React Flow.
6. Prompt Gemini + documentação.
7. Lint e testes com output final.
