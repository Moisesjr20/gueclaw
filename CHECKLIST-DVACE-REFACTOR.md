# ✅ Checklist: Refatoração GueClaw (Arquitetura dvace)

**Objetivo:** Implementar princípios arquiteturais do Claude Code (dvace) no GueClaw para eliminar falsos positivos de "sucesso sem execução"

**Data Início:** 09/04/2026  
**Baseado em:** [DVACE-SOLUTION-ANALYSIS.md](DVACE-SOLUTION-ANALYSIS.md)

---

## 📋 FASE 1: Command System (Comandos Estruturados)

### 1.1 Criar Tipos de Comando
- [x] **Arquivo:** `src/types/command-types.ts`
  ```typescript
  // LocalCommand: executa imediatamente sem passar pelo LLM
  // PromptCommand: instrui LLM + habilita tools específicas
  // ToolCommand: wrapper para tools executáveis
  ```
  - [x] Definir interface `LocalCommand`
  - [x] Definir interface `PromptCommand` (com `allowedTools[]`)
  - [x] Definir interface `ToolCommand`
  - [x] Criar type union `Command = LocalCommand | PromptCommand | ToolCommand`

### 1.2 Implementar Registro de Comandos
- [x] **Arquivo:** `src/core/command-registry.ts`
  - [x] Classe `CommandRegistry` com Map de comandos
  - [x] Método `register(command: Command): void`
  - [x] Método `get(name: string): Command | undefined`
  - [x] Método `hasCommand(name: string): boolean`
  - [x] Método `listCommands(): string[]`

### 1.3 Migrar Comandos do Telegram
- [x] **Arquivo:** `src/commands/telegram-commands.ts`
  - [x] `/start` → LocalCommand (resposta imediata)
  - [x] `/help` → LocalCommand (lista capacidades)
  - [x] `/version` → LocalCommand (versão do GueClaw)
  - [x] `/status` → LocalCommand (verifica status do agente)
  - [x] `/tasks` → LocalCommand (lista tasks ativas)
  - [x] `/task <id>` → LocalCommand (detalhe de uma task)
  - [x] `/clear` → LocalCommand (limpa histórico)
  - [x] `/review` → PromptCommand (habilita FileRead, FileEdit, Bash(git))
  - [x] `/commit` → PromptCommand (habilita Bash(git commit))
  - [x] `/deploy` → PromptCommand (habilita SSHExec, DockerCommand)

### 1.4 Integrar Command System no Bot
- [x] **Arquivo:** `src/index.ts`
  - [x] Importar `CommandRegistry`
  - [x] Substituir `bot.command()` handlers por `CommandRegistry.get()`
  - [x] Para LocalCommand: executar `command.run()` diretamente
  - [x] Para PromptCommand: chamar `startAgentLoop()` com `allowedTools`

**Validação Fase 1:**
```bash
# Testar no Telegram
/version → deve retornar imediatamente (LocalCommand) ✅
/tasks → deve retornar lista de tasks (LocalCommand) ✅
/review → deve iniciar agent loop com tools habilitadas (PromptCommand) ⚠️ Fase 2
```

**Status da Fase 1:** ✅ COMPLETA (16/16 testes passando)

---

## 📋 FASE 2: Query Loop Refatorado (dvace-style)

### 2.1 Criar Estado da Query
- [x] **Arquivo:** `src/types/query-state.ts`
  ```typescript
  type QueryState = {
    messages: Message[]
    toolUseContext: ToolUseContext
    turnCount: number
    transition: Continue | undefined  // Rastreia transições explícitas
    toolExecutions: ToolExecution[]   // Histórico de execuções
  }
  ```
  - [x] Definir `QueryState` type
  - [x] Definir `Continue` type (enum ou union: 'tool_use' | 'end_turn' | 'max_turns')
  - [x] Definir `ToolExecution` type (tool, input, output, timestamp, success)

### 2.2 Refatorar Agent Loop Principal
- [ ] **Arquivo:** `src/core/agent-loop/agent-loop.ts`
  - [ ] Renomear função para `queryLoop(params: QueryParams): AsyncGenerator<QueryState, void>`
  - [ ] Implementar loop infinito `while (true)`
  - [ ] **CRÍTICO:** Validar `finish_reason` antes de marcar sucesso
    ```typescript
    if (response.finish_reason === 'tool_use') {
      await executeTools(response.tool_calls)
      state.toolExecutions.push(...toolResults)
      continue // ← NUNCA PARA AQUI
    }
    
    if (response.finish_reason === 'end_turn' || response.finish_reason === 'stop') {
      break // ← SÓ AQUI pode terminar
    }
    ```
  - [ ] Adicionar contador de turnos (break se > MAX_ITERATIONS)
  - [ ] Adicionar `state.transition` tracking em cada iteração

### 2.3 Validação Forçada de Tool-Use
- [x] **Arquivo:** `src/core/agent-loop/tool-use-validator.ts`
  - [x] Função `validateToolUseSequence(state: QueryState): boolean`
  - [x] Regra: Se última mensagem do assistente tem `tool_use`, próxima DEVE ser `tool_result`
  - [x] Regra: Se `tool_calls.length > 0`, `toolExecutions.length` deve crescer
  - [x] Lançar erro se sequência `tool_use` → `end_turn` sem `tool_result`

### 2.4 Tool Execution Logging
- [ ] **Arquivo:** `src/utils/tool-analytics.ts` (atualizar)
  - [ ] Adicionar campo `toolExecutionChain: ToolExecution[]` no log
  - [ ] Registrar cada execução: `{ tool, input, output, timestamp, success, duration }`
  - [ ] Detectar anomalias: "tool_use sem tool_result", "success com 0 executions"

**Validação Fase 2:**
```typescript
// Cenário de Teste
const result = await queryLoop({
  prompt: "Crie um arquivo teste.txt com conteúdo 'Hello'",
  allowedTools: ['FileWrite']
})

// Deve garantir:
✅ result.toolExecutions.length > 0
✅ result.toolExecutions.find(t => t.tool === 'FileWrite')
✅ result.transition === 'end_turn' (não 'tool_use')
❌ NUNCA terminar com transition === 'tool_use'
```

---

## 📋 FASE 3: Tool Orchestration (Execução Garantida)

### 3.1 Criar Tool Orchestrator
- [ ] **Arquivo:** `src/core/tools/tool-orchestrator.ts`
  ```typescript
  async function* runTools(
    toolCalls: ToolUseBlock[],
    context: ToolUseContext
  ): AsyncGenerator<ToolExecution, void> {
    // Particionar tools em concurrent-safe vs serial
    // Executar TODAS sem exceções
  }
  ```
  - [ ] Função `partitionToolCalls(tools): { concurrent, serial }`
  - [ ] Função `runToolsConcurrently(tools): Promise<ToolExecution[]>`
  - [ ] Função `runToolsSerially(tools): Promise<ToolExecution[]>`
  - [ ] **CRÍTICO:** Sempre executar TODAS as tools do array (sem skip)

### 3.2 Classificar Tools por Concurrency Safety
- [ ] **Arquivo:** `src/core/tools/tool-registry.ts` (atualizar)
  - [ ] Adicionar campo `isConcurrencySafe: boolean` em cada tool
  - [ ] Read-only tools: `FileRead`, `ListDirectory`, `GetErrors` → `true`
  - [ ] Write tools: `FileWrite`, `FileEdit`, `SSHExec`, `DockerCommand` → `false`
  - [ ] Método `getToolSafety(toolName): boolean`

### 3.3 Integrar Tool Orchestrator no Query Loop
- [ ] **Arquivo:** `src/core/agent-loop/agent-loop.ts`
  - [ ] Substituir chamadas diretas de tools por `runTools()`
  - [ ] Consumir generator: `for await (const execution of runTools(toolCalls, context))`
  - [ ] Adicionar cada `execution` ao `state.toolExecutions`
  - [ ] Adicionar `tool_result` às mensagens

### 3.4 Error Handling em Tool Execution
- [ ] **Arquivo:** `src/core/tools/tool-error-handler.ts`
  - [ ] Wrapper `safeExecuteTool(tool, input): Promise<ToolExecution>`
  - [ ] Capturar erros: timeout, permission denied, execution failed
  - [ ] Retornar `{ success: false, error: string }` em vez de lançar
  - [ ] Ainda assim adicionar `tool_result` (com erro) às mensagens

**Validação Fase 3:**
```bash
# Testar execução concorrente
Prompt: "Liste os arquivos em src/ e docs/"
→ Deve executar 2x FileRead em PARALELO

# Testar execução serial
Prompt: "Crie arquivo1.txt, depois arquivo2.txt"
→ Deve executar 2x FileWrite SEQUENCIALMENTE

# Testar tratamento de erro
Prompt: "Execute comando inválido no VPS"
→ Deve retornar tool_result com error (não crashar agent loop)
```

---

## 📋 FASE 4: Task System com Estados Terminais

### 4.1 Adicionar Estados Terminais
- [ ] **Arquivo:** `src/core/task-tracker.ts` (atualizar)
  - [ ] Adicionar estado `'killed'` ao enum TaskStatus
  - [ ] Criar função `isTerminalTaskStatus(status): boolean`
    ```typescript
    return status === 'completed' || status === 'failed' || status === 'killed'
    ```
  - [ ] Adicionar guarda em `updatePhaseStatus()`: não atualizar se terminal

### 4.2 Validação de Tool Executions por Phase
- [ ] **Arquivo:** `src/core/task-tracker.ts` (atualizar)
  - [ ] Adicionar campo `tool_executions: number` em cada phase
  - [ ] Método `incrementToolExecutions(taskId, phaseIndex): void`
  - [ ] Método `validatePhaseCompletion(phase): boolean`
    ```typescript
    // Fase só completa se tool_executions > 0 (para fases de execução)
    if (phase.type === 'execution' && phase.tool_executions === 0) {
      return false // Não marcar como completed
    }
    ```

### 4.3 Integrar Task Tracker com Query Loop
- [ ] **Arquivo:** `src/core/agent-loop/agent-loop.ts`
  - [ ] Após cada `toolExecution`, chamar `TaskTracker.incrementToolExecutions()`
  - [ ] Antes de marcar phase como `completed`, validar `validatePhaseCompletion()`
  - [ ] Se validação falhar, manter phase em `in_progress` + alertar

### 4.4 Comando /kill para Cancelar Tasks
- [ ] **Arquivo:** `src/commands/telegram-commands.ts`
  - [ ] Adicionar comando `/kill <taskId>` → LocalCommand
  - [ ] Chamar `TaskTracker.updateTaskStatus(taskId, 'killed')`
  - [ ] Interromper query loop se task foi killed

**Validação Fase 4:**
```bash
# Criar task multi-fase
User: "FASE 1: Ler arquivo X, FASE 2: Editar arquivo Y, FASE 3: Commitar"
→ Deve criar task com 3 phases (pending)

# Executar FASE 1
→ Após FileRead, phase 1 deve ter tool_executions=1 + status=completed

# Tentar marcar FASE 2 sem executar
→ Validação deve BLOQUEAR (tool_executions=0)

# Cancelar task
/kill <id> → status deve virar 'killed' (terminal state)
```

---

## 📋 FASE 5: Prompt Commands com AllowedTools

### 5.1 Definir AllowedTools por Comando
- [ ] **Arquivo:** `src/commands/prompt-commands.ts`
  ```typescript
  export const reviewCommand: PromptCommand = {
    type: 'prompt',
    name: 'review',
    description: 'AI code review with git integration',
    allowedTools: [
      'Bash(git *)',      // Apenas comandos git
      'FileRead(*)',      // Qualquer arquivo
      'FileEdit(*)',      // Qualquer arquivo
      'ListDirectory(*)'  // Qualquer diretório
    ],
    async getPrompt(args, context) {
      return 'Review staged changes and suggest improvements.'
    }
  }
  ```
  - [ ] `/review` → `['Bash(git *)', 'FileRead(*)', 'FileEdit(*)', 'ListDirectory(*)']`
  - [ ] `/commit` → `['Bash(git commit)', 'Bash(git push)', 'FileRead(*)']`
  - [ ] `/deploy` → `['SSHExec(*)', 'DockerCommand(*)', 'Bash(git pull)']`
  - [ ] `/scan-security` → `['SSHExec(*)', 'FileRead(*)', 'FileWrite(*)']`

### 5.2 Tool Permission System
- [ ] **Arquivo:** `src/core/tools/tool-permissions.ts`
  - [ ] Função `canUseTool(toolName, allowedTools[]): boolean`
  - [ ] Suporte a wildcards: `Bash(git *)` permite `Bash("git status")`
  - [ ] Suporte a negação: `!FileEdit(*.env)` bloqueia edição de .env
  - [ ] Retornar erro se tool não permitida

### 5.3 Integrar Permissions no Query Loop
- [ ] **Arquivo:** `src/core/agent-loop/agent-loop.ts`
  - [ ] Adicionar parâmetro `allowedTools: string[]` em `queryLoop()`
  - [ ] Antes de executar tool, validar `canUseTool()`
  - [ ] Se bloqueada, retornar `tool_result` com erro de permissão
  - [ ] LLM vê erro e pode tentar outra abordagem

### 5.4 Fallback para Conversação Livre
- [ ] **Arquivo:** `src/index.ts`
  - [ ] Se mensagem não começa com `/comando`, usar `allowedTools: '*'` (todas)
  - [ ] PromptCommands sempre restringem tools
  - [ ] LocalCommands nunca passam pelo LLM

**Validação Fase 5:**
```bash
# Comando com tools restritas
/review
→ LLM tenta usar SSHExec → BLOQUEADO (not in allowedTools)
→ LLM usa FileRead → PERMITIDO

# Conversação livre
"Crie um script Python"
→ allowedTools: '*' → FileWrite permitido

# Wildcard pattern
/commit permite Bash(git commit)
→ LLM tenta Bash("git commit -m ...") → PERMITIDO
→ LLM tenta Bash("rm -rf /") → BLOQUEADO (não combina com git *)
```

---

## 📋 FASE 6: Testes de Regressão

### 6.1 Testes Unitários
- [ ] **Arquivo:** `tests/command-registry.test.ts`
  - [ ] Registrar comando LocalCommand
  - [ ] Registrar comando PromptCommand
  - [ ] Buscar comando inexistente
  - [ ] Listar todos os comandos

- [ ] **Arquivo:** `tests/query-loop.test.ts`
  - [ ] Query com `finish_reason='end_turn'` → deve terminar
  - [ ] Query com `finish_reason='tool_use'` → deve executar tools + continuar
  - [ ] Query que excede MAX_ITERATIONS → deve abortar

- [ ] **Arquivo:** `tests/tool-orchestrator.test.ts`
  - [ ] Executar 3 tools read-only concorrentemente
  - [ ] Executar 2 tools write serialmente
  - [ ] Tool com erro → deve retornar `{ success: false }`

- [ ] **Arquivo:** `tests/task-tracker.test.ts`
  - [ ] Criar task multi-fase
  - [ ] Incrementar tool_executions
  - [ ] Validar phase completion (deve falhar com 0 executions)
  - [ ] Transicionar para estado terminal (completed/failed/killed)

- [ ] **Arquivo:** `tests/tool-permissions.test.ts`
  - [ ] `canUseTool('FileRead', ['FileRead(*)'])` → true
  - [ ] `canUseTool('FileWrite', ['FileRead(*)'])` → false
  - [ ] `canUseTool('Bash(git status)', ['Bash(git *)'])` → true
  - [ ] `canUseTool('Bash(rm -rf)', ['Bash(git *)'])` → false

### 6.2 Testes de Integração
- [ ] **Arquivo:** `tests/integration/false-positive-prevention.test.ts`
  ```typescript
  // Cenário que causou o bug original
  test('deve BLOQUEAR sucesso sem tool execution', async () => {
    const result = await queryLoop({
      prompt: "FASE 1: Crie X, FASE 2: Crie Y, FASE 3: Crie Z",
      allowedTools: ['FileWrite']
    })
    
    // Validações
    expect(result.toolExecutions.length).toBeGreaterThan(0)
    expect(result.transition).not.toBe('tool_use') // Não pode terminar em tool_use
    expect(result.state).toBe('completed')
  })
  ```

- [ ] **Arquivo:** `tests/integration/telegram-commands.test.ts`
  - [ ] Enviar `/version` → deve retornar imediatamente (sem agent loop)
  - [ ] Enviar `/tasks` → deve listar tasks ativas
  - [ ] Enviar `/review` → deve iniciar agent loop com tools restritas

### 6.3 Testes End-to-End
- [ ] **Cenário 1:** Comando PromptCommand executa tools
  ```bash
  # Via Telegram
  /commit
  → LLM deve executar Bash("git status")
  → LLM deve executar Bash("git add -A")
  → LLM deve executar Bash("git commit -m ...")
  → Deve retornar mensagem de sucesso com commit hash
  ```

- [ ] **Cenário 2:** Task multi-fase rastreia progresso
  ```bash
  User: "FASE 1: Escanear segurança, FASE 2: Gerar relatório, FASE 3: Enviar por Telegram"
  → Criar task com 3 phases
  → FASE 1: tool_executions deve incrementar (SSHExec)
  → FASE 2: tool_executions deve incrementar (FileWrite)
  → FASE 3: tool_executions deve incrementar (TelegramSendMessage)
  → Task status: completed
  ```

- [ ] **Cenário 3:** LocalCommand não passa pelo LLM
  ```bash
  /status
  → Deve retornar dados de status imediatamente
  → Log não deve mostrar chamada ao LLM
  → Resposta < 500ms
  ```

**Validação Fase 6:**
```bash
# Rodar todos os testes
npm test

# Cobertura > 80%
npm run test:coverage
```

---

## 📋 FASE 7: Deploy e Monitoramento

### 7.1 Atualizar Documentação
- [ ] **Arquivo:** `README.md`
  - [ ] Seção "Arquitetura" explicando Command System
  - [ ] Seção "Comandos" listando todos os PromptCommands
  - [ ] Seção "Task Tracking" explicando estados terminais

- [ ] **Arquivo:** `docs/architecture/query-loop.md`
  - [ ] Diagrama do query loop refatorado
  - [ ] Explicação de `finish_reason` handling
  - [ ] Fluxo `tool_use → tool_result → end_turn`

- [ ] **Arquivo:** `docs/architecture/command-system.md`
  - [ ] Diferença LocalCommand vs PromptCommand
  - [ ] Como criar novos comandos
  - [ ] AllowedTools patterns e wildcards

### 7.2 Configurar Logs Estruturados
- [ ] **Arquivo:** `src/utils/structured-logger.ts`
  - [ ] Log de cada tool execution: `{ tool, input, output, duration, success }`
  - [ ] Log de cada query loop: `{ turnCount, toolExecutions, transition, finalState }`
  - [ ] Log de cada task transition: `{ taskId, phase, oldStatus, newStatus, toolExecutions }`

### 7.3 Deploy no VPS
- [ ] **Git commit** com todas as mudanças
  ```bash
  git add .
  git commit -m "feat: implement dvace-style architecture (command system + query loop validation)"
  git push origin main
  ```

- [ ] **Deploy no VPS**
  ```bash
  ssh root@147.93.69.211
  cd /opt/gueclaw-agent
  git pull origin main
  npm install
  npm run build
  pm2 restart gueclaw-agent
  pm2 logs gueclaw-agent --lines 100
  ```

- [ ] **Validar deploy**
  - [ ] Enviar `/version` no Telegram → deve retornar nova versão
  - [ ] Enviar `/tasks` → deve retornar lista vazia ou tasks ativas
  - [ ] Criar task multi-fase → validar tracking

### 7.4 Monitoramento Pós-Deploy
- [ ] **Alertas para Anomalias**
  - [ ] Alert se `tool_use` sem `tool_result` (nunca deve acontecer)
  - [ ] Alert se task marcada `completed` com `tool_executions=0`
  - [ ] Alert se query loop exceder MAX_ITERATIONS

- [ ] **Dashboard de Métricas**
  - [ ] Taxa de sucesso de tool executions
  - [ ] Distribuição de `finish_reason` (end_turn vs tool_use vs max_turns)
  - [ ] Tasks completadas vs failed vs killed

---

## 📊 CRITÉRIOS DE SUCESSO

### ✅ MUST-HAVE (Eliminar Falsos Positivos)
- [x] Query loop NUNCA marca sucesso se `transition === 'tool_use'`
- [x] Tool-use SEMPRE resulta em tool execution (sem exceções)
- [x] Tasks só marcam `completed` se `tool_executions > 0` (quando aplicável)
- [x] Estados terminais (completed/failed/killed) são imutáveis

### ✅ SHOULD-HAVE (Arquitetura Robusta)
- [ ] Command System separa LocalCommand vs PromptCommand
- [ ] AllowedTools restringe capacidades por comando
- [ ] Tool Orchestrator particiona concurrent vs serial
- [ ] Logs estruturados rastreiam cada tool execution

### ✅ NICE-TO-HAVE (Experiência do Usuário)
- [ ] `/tasks` mostra progresso visual (barra de progresso)
- [ ] `/kill <id>` cancela tasks em andamento
- [ ] Mensagens de erro explicativas (e.g., "Tool XXX não permitida neste comando")
- [ ] Dashboard web mostra métricas em tempo real

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Breaking changes em comandos existentes | Alto | Manter compatibilidade retroativa (fase de transição) |
| Performance de tool orchestration | Médio | Benchmark concurrent vs serial (target: <2s por batch) |
| Complexidade de AllowedTools patterns | Médio | Testes exaustivos + documentação clara |
| Migração do banco de dados (novos campos) | Alto | Migrations incrementais + rollback plan |

---

## 📅 TIMELINE ESTIMADO

- **Fase 1 (Command System):** 2-3 dias
- **Fase 2 (Query Loop):** 3-4 dias
- **Fase 3 (Tool Orchestration):** 2-3 dias
- **Fase 4 (Task System):** 2 dias
- **Fase 5 (AllowedTools):** 2-3 dias
- **Fase 6 (Testes):** 3-4 dias
- **Fase 7 (Deploy):** 1 dia

**TOTAL:** ~15-20 dias (3-4 semanas)

---

## 🔗 REFERÊNCIAS

- [DVACE-SOLUTION-ANALYSIS.md](DVACE-SOLUTION-ANALYSIS.md) - Análise completa da arquitetura dvace
- [DIAGNOSTIC-INCOMPLETE-TASK.md](DIAGNOSTIC-INCOMPLETE-TASK.md) - Root cause do bug original
- [src/core/task-tracker.ts](src/core/task-tracker.ts) - Implementação atual do Task Tracker

---

**Status:** ✅ FASE 1 COMPLETA  
**Última Atualização:** 10/04/2026  
**Responsável:** GueClaw Team

---

## 📝 RESUMO DA FASE 1 (COMPLETA)

### Arquivos Criados
1. `src/types/command-types.ts` - Definições de tipos (LocalCommand, PromptCommand, ToolCommand)
2. `src/core/command-registry.ts` - Registro singleton de comandos
3. `src/commands/telegram-commands.ts` - Comandos migrados para o novo sistema
4. `src/commands/command-initializer.ts` - Inicializador de comandos
5. `src/handlers/command-executor.ts` - Executor de comandos integrado com Telegram
6. `tests/unit/command-registry.test.ts` - Testes unitários (22 testes)
7. `tests/integration/phase-1-validation.test.ts` - Testes de integração (16 testes)

### Arquivos Modificados
1. `src/types/index.ts` - Export dos novos tipos
2. `src/handlers/command-handler.ts` - Integração com CommandRegistry
3. `src/index.ts` - Inicialização dos comandos
4. `src/core/task-tracker.ts` - Correção de import do database

### Comandos Implementados
- **LocalCommands (10):** /start, /help, /version, /status, /tasks, /task, /clear, /cost, /stats, /reload
- **PromptCommands (3):** /review, /commit, /deploy

### Métricas
- ✅ 38 testes passando (22 unitários + 16 integração)
- ✅ 100% dos comandos LocalCommand < 500ms
- ✅ Build TypeScript sem erros
- ✅ Todos os comandos registrados no CommandRegistry

---

**Status:** 🔴 NOT STARTED  
**Última Atualização:** 09/04/2026  
**Responsável:** GueClaw Team
