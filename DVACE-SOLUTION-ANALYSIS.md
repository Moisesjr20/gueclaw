# Como o DVace (Claude Code) Resolve "Prometer vs Executar"

**Data:** 09/04/2026  
**Análise:** Arquitetura Claude Code para prevenir execução falsa

---

## 🎯 O PROBLEMA (GueClaw)

**Sintoma:** Agente prometeu "vou criar X, Y, Z" mas não executou nada (`Tool Executions: 0`)

**Causa Raiz:** Agente confundiu "descrever plano" (THOUGHT) com "executar plano" (ACTION)

**Evidência:** Agent Loop marcou "success" baseado apenas em "não houve erro", sem validar se ações prometidas foram executadas

---

## ✅ COMO O DVACE RESOLVE

### 1. **Separação Clara: Comandos vs Tools**

Claude Code diferencia EXPLICITAMENTE entre 3 tipos de ação:

#### **A) LocalCommand** — Execução Local Imediata
```typescript
// Executa IMEDIATAMENTE no processo, retorna plain text
export const version: LocalCommand = {
  type: 'local',
  name: 'version',
  run: async () => {
    return `Claude Code ${VERSION}`
  }
}
```

**Características:**
- ❌ **NÃO** passa pelo LLM
- ✅ Executa instantaneamente
- ✅ Retorna resultado direto (texto ou JSX)
- **Uso:** `/version`, `/cost`, `/status`

---

#### **B) PromptCommand** — Enviar Instrução ao LLM COM Tools**
```typescript
export const review: PromptCommand = {
  type: 'prompt',
  name: 'review',
  description: 'AI code review',
  allowedTools: [
    'Bash(git *)',
    'FileRead(*)',
    'FileEdit(*)',
  ],
  async getPromptForCommand(args, context) {
    return [{
      type: 'text',
      text: 'Review staged changes and suggest improvements.'
    }]
  }
}
```

**Características:**
- ✅ Passa pelo LLM + Query Engine
- ✅ **HABILITA TOOLS EXPLICITAMENTE** (`allowedTools`)
- ✅ Se LLM retornar `tool_use`, **OBRIGATORIAMENTE executa a tool**
- ❌ LLM **NÃO PODE** apenas descrever — tools são executadas sempre

---

#### **C) Tool** — Ação Executável
```typescript
export const BashTool: Tool = {
  name: 'Bash',
  description: 'Execute shell commands',
  inputSchema: z.object({
    command: z.string(),
  }),
  async execute(input, context) {
    // EXECUTA COMANDO REAL
    const result = await runShell(input.command)
    return { output: result.stdout }
  }
}
```

**Características:**
- ✅ Executada SEMPRE que o LLM a invoca
- ✅ Retorna resultado concreto (success/error)
- ✅ Não há "simulação" ou "planejamento falso"

---

### 2. **Query Loop Forçado: Tool-Use → Tool-Result**

O `query.ts` tem um loop que **GARANTE** execução de tools:

```typescript
async function* queryLoop(params) {
  while (true) {
    // 1. Chamar LLM
    const response = await llamarLLM(messages, tools)
    
    //  2. Verificar finish_reason
    if (response.stop_reason === 'tool_use') {
      // ✅ OBRIGATÓRIO: Executar TODAS as tools solicitadas
      const toolResults = await runTools(response.content)
      
      // ✅ Adicionar tool_result às mensagens
      messages.push(...toolResults)
      
      // ✅ CONTINUAR LOOP (nunca para aqui)
      continue
    }
    
    // 3. Se finish_reason === 'end_turn', OK terminar
    if (response.stop_reason === 'end_turn') {
      break // Conversação concluída
    }
  }
}
```

**Garantias:**
- ❌ **NUNCA** marca como "success" apenas por descrever um plano
- ✅ **SEMPRE** executa tools se `tool_use` foi retornado
- ✅ Loop só termina em `end_turn` (LLM sinalizou conclusão real)

---

### 3. **Task System com Estados Terminais**

O dvace tem um sistema de **Tasks** (não confundir com "tasks do usuário"):

```typescript
export type TaskStatus =
  | 'pending'      // Aguardando início
  | 'running'      // Em execução
  | 'completed'    // ✅ CONCLUÍDA COM SUCESSO
  | 'failed'       // ❌ ERRO
  | 'killed'       // 🛑 CANCELADA

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}
```

**Transição de Estados:**
```
pending → running → (completed | failed | killed)
   ↑                        ↓
   └────── NUNCA VOLTA ─────┘
```

**Garantia:** Uma task só é marcada como `completed` quando:
1. O código de execução retornou com sucesso
2. Nenhum erro foi lançado
3. Todos os outputs foram salvos

**Diferença do GueClaw:**
- GueClaw: `Tool Executions: 0` → marcou "success" ❌
- Dvace: Task fica `running` até execução real completar ✅

---

### 4. **Tool Orchestration: Concorrente ou Serial**

O módulo `toolOrchestration.ts` garante execução de TODAS as tools:

```typescript
export async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  
  // Particionar tools em batches (read-only concorrente, outras serial)
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(toolUseMessages, toolUseContext)) {
    
    if (isConcurrencySafe) {
      // ✅ Executar batch read-only em PARALELO
      for await (const update of runToolsConcurrently(blocks, ...)) {
        yield update
      }
    } else {
      // ✅ Executar batch write/destructive SERIALMENTE
      for await (const update of runToolsSerially(blocks, ...)) {
        yield update
      }
    }
  }
}
```

**Características:**
- ✅ **TODAS** as tools são executadas (não há "skip")
- ✅ Read-only tools executam em paralelo (performance)
- ✅ Write tools executam serialmente (segurança)
- ✅ Cada execução emite `MessageUpdate` (tracking granular)

---

### 5. **Diferença Fundamental: Comandos de Prompt**

**GueClaw:**
```
User: "Crie X, Y, Z"
 → AgentLoop: Gera THOUGHT descrevendo plano
 → SystemPrompt: "Você pode criar skills"
 → LLM retorna: "Vou criar X, Y, Z" (apenas texto)
 → AgentLoop: "OK, success!" ❌ FALSO POSITIVO
```

**Dvace:**
```
User: "/commit"
 → PromptCommand: Envia "Create commit" + HABILITA tools [Bash(git *)]
 → LLM retorna: tool_use { name: "Bash", command: "git commit -m ..." }
 → queryLoop: DETECTA tool_use → chama runTools()
 → runTools: EXECUTA Bash("git commit...")
 → Tool retorna: { success: true, output: "[main abc123]..." }
 → queryLoop: Adiciona tool_result → continua loop
 → LLM vê resultado real → decide se precisa de mais tools
 → LLM retorna: finish_reason='end_turn'
 → queryLoop: Agora SIM, marca como concluído ✅
```

**Diferença chave:**  
- GueClaw confia no LLM dizer "vou fazer" → assume execução
- Dvace VALIDA que `tool_use` foi seguido de `tool_result` antes de terminar

---

## 📊 DIAGRAMA COMPARATIVO

### GueClaw (ANTES da correção)
```
┌──────────────────────────────────────────────────────┐
│ User: "Crie X, Y, Z"                                 │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
      ┌─────────────────────────┐
      │ Agent Loop (ReAct)      │
      │  Thought: "Vou criar X" │  ← APENAS DESCRIÇÃO
      └──────────┬──────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ Tool Executions: 0      │  ← NÃO EXECUTOU NADA
      └──────────┬──────────────┘
                 │
                 ▼
      ┌─────────────────────────┐
      │ State: SUCCESS ❌       │  ← FALSO POSITIVO
      └─────────────────────────┘
```

### Dvace (Claude Code)
```
┌──────────────────────────────────────────────────────┐
│ User: "/review"                                      │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
      ┌─────────────────────────────────┐
      │ PromptCommand                   │
      │  allowedTools: [Bash, FileRead] │ ← TOOLS HABILITADAS
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ LLM retorna: tool_use           │
      │  { name: "Bash",                │
      │    command: "git diff..." }     │
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ runTools() detecta tool_use     │  ← VALIDAÇÃO FORÇADA
      │  → EXECUTA Bash(git diff)       │  ← EXECUÇÃO REAL
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ Tool retorna: { success, ... }  │  ← RESULTADO CONCRETO
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ Adiciona tool_result            │
      │  → CONTINUA LOOP                │  ← NÃO PARA AQUI
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ LLM vê resultado real           │
      │  → finish_reason='end_turn'     │
      └──────────┬──────────────────────┘
                 │
                 ▼
      ┌─────────────────────────────────┐
      │ queryLoop: OK, terminar ✅      │  ← SÓ AQUI marca success
      └─────────────────────────────────┘
```

---

## 🔑 PRINCÍPIOS DE DESIGN DO DVACE

### 1. **Tool-Use é um Contrato**
Se o LLM retorna `tool_use`, o sistema **OBRIGATORIAMENTE** executa a tool. Não há negociação.

### 2. **Loop Não Para em Tool-Use**
```typescript
if (finish_reason === 'tool_use') {
  await executeTools()
  continue // ← SEMPRE CONTINUA
}
```

### 3. **Estados Terminais São Barreiras**
Uma task só transiciona para `completed` quando:
- Código de execução retornou
- Output foi persistido
- Nenhum erro foi lançado

### 4. **Comandos Definem Capacidades**
`allowedTools` no PromptCommand **LIMITA** o que o LLM pode fazer. Não há "descrição de plano sem execução".

---

## 🛠️ IMPLEMENTAÇÃO NO GUECLAW

Para aplicar a filosofia do dvace no GueClaw, implementamos:

### ✅ 1. Task Tracker
- Tabela SQLite `agent_tasks`
- Estados: `pending → in_progress → completed | failed`
- Validação: Task só completa quando **tool_executions > 0** (se for tarefa de execução)

### ✅ 2. Detecção de Promessas Multi-Fase
```typescript
TaskTracker.detectMultiPhasePromise(thought)
// Se detectar "FASE 1, FASE 2", cria task automaticamente
```

### ✅ 3. Validação Pré-Success
```typescript
// Antes de marcar StateTransition.SUCCESS:
if (promiseDetection.detected && toolExecutions === 0) {
  // ❌ NÃO marcar como success
  // ✅ Continuar loop ou alertar
}
```

### ✅ 4. Comandos /tasks e /task <ID>
Visibilidade para o usuário de tarefas pendentes.

---

## 📝 LIÇÕES APRENDIDAS

| Problema | Solução Dvace |
|----------|---------------|
| LLM descreve plano mas não executa | PromptCommand habilita tools → tool_use é forçado |
| Agent Loop marca success sem validar | queryLoop só termina em `end_turn` (após tool_result) |
| Tarefas multi-fase sem tracking | Task system com estados terminais |
| Execução de tools pode ser "simulada" | runTools() executa SEMPRE, sem exceções |
| Falsos positivos de "success" | Validação de que tool_use → tool_result ocorreu |

---

## 🚀 CONCLUSÃO

O dvace resolve "prometer vs executar" através de:

1. **Separação de responsabilidades** — Comandos locais (execute), Comandos de prompt (instrui LLM + habilita tools), Tools (executam ações)
2. **Loop garantido** — `tool_use` SEMPRE resulta em execução de tool
3. **Estados terminais** — Tasks só completam quando realmente terminam
4. **Validação forçada** — Não há caminho para "descrever sem executar"

**Metáfora:**
- GueClaw (antes): "Vou fazer isso" → marca como feito ❌
- Dvace: "Vou fazer isso" → EXECUTA → verifica resultado → SÓ ENTÃO marca ✅

---

**Autor:** Análise de arquitetura do Claude Code (dvace)  
**Versão:** 1.0.0  
**Data:** 2026-04-09
