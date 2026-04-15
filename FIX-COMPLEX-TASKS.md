# Fix: Agent Não Executa Tarefas Complexas

## 🔴 PROBLEMA IDENTIFICADO

**Sintoma:**
- Tarefas simples: ✅ Funcionam (ex: "crie arquivo teste.txt")
- Tarefas complexas: ❌ Só descrevem (ex: "delete arquivo + create automação systemd")

**Evidência dos Logs:**
```
TAREFA SIMPLES (Funcionou):
🔁 Iteration 2/30
   Finish Reason: tool_calls  ✅
   Tool Executions: 2

TAREFA COMPLEXA (Falhou):
🔁 Iteration 1/5  ← MAX_ITERATIONS voltou para 5!
   Finish Reason: stop  ❌
   Tool Executions: 0
   Content: "📥 SOLICITAÇÃO... ⚡ EXECUÇÃO..." (só texto)
```

---

## 🎯 ROOT CAUSE

### 1. System Prompt Induz "Planejamento"

Formato atual:
```typescript
📥 SOLICITAÇÃO: [descrição]
🔍 ANÁLISE: [análise]
⚡ EXECUÇÃO: [ferramentas usadas]
✅ RESULTADO: [resultado]
```

**Problema:** LLM Claude interpreta isso como "template para descrever o plano", não como "execute primeiro, resuma depois".

### 2. MAX_ITERATIONS Inconsistente

- `.env` local: `MAX_ITERATIONS=30`
- Logs mostram: `Iteration 1/5` (ignorou o .env!)
- AgentController override para skills específicas

### 3. Ausência de Tool-Use Enforcement

Não há guardrail forçando execução quando:
- Turno = 1
- Tool Executions = 0
- Finish Reason = stop (sem tool_calls)

---

## ✅ SOLUÇÃO (Baseada em DVACE Architecture)

### FIX 1: Reescrever System Prompt (Imperativo)

**Antes (Descritivo):**
```
REGRAS CRÍTICAS DE EXECUÇÃO:
1. NUNCA diga "vou fazer X"
2. SEMPRE chame as ferramentas necessárias
3. Sua resposta final deve ser um RESUMO

FORMATO OBRIGATÓRIO DE RESPOSTA:
📥 SOLICITAÇÃO → 🔍 ANÁLISE → ⚡ EXECUÇÃO → ✅ RESULTADO
```

**Depois (Imperativo - DVACE Style):**
```
CRITICAL EXECUTION RULES:
1. READ the user's request carefully
2. EXECUTE the required tools IMMEDIATELY
3. RESPOND with results AFTER execution completes

NEVER write "I will do X" or "I'm going to do X"
NEVER describe what you would do without doing it first
ALWAYS execute → then summarize

Example:
User: "Create file.txt with 'hello'"
WRONG: I'll create the file (no tool call)
CORRECT: [executes file_operations] → "Created file.txt with content 'hello'"
```

### FIX 2: Enforce Tool Execution Guardrail

**agent-loop.ts (linha ~250):**
```typescript
// After first iteration, if no tools called → force retry
if (iteration === 1 && 
    this.state.totalToolExecutions === 0 && 
    response.finishReason === 'stop') {
  
  console.warn('⚠️ LLM did not call any tools on first iteration');
  console.warn('   Forcing tool-use retry...');
  
  this.conversationHistory.push({
    conversationId: 'temp',
    role: 'user',
    content: '[SYSTEM INSTRUCTION]: You described what you would do, but did NOT execute any tools. You MUST use the available tools (vps_execute_command, file_operations, etc.) to complete the task. Execute now.'
  });
  
  continue; // Retry with explicit instruction
}
```

### FIX 3: Remover Formato Estruturado

**agent-loop.ts `getDefaultSystemPrompt()`:**

Remove:
```typescript
FORMATO OBRIGATÓRIO DE RESPOSTA (use sempre para tarefas com ação):
📥 SOLICITAÇÃO → 🔍 ANÁLISE → ⚡ EXECUÇÃO → ✅ RESULTADO
```

Substitui por:
```typescript
RESPONSE FORMAT:
- For questions: answer directly
- For actions: execute tools first, then summarize what was done
- Use emojis naturally, but don't force a specific template
```

### FIX 4: Garantir MAX_ITERATIONS Consistente

**agent-loop.ts (constructor):**
```typescript
// BEFORE (problema):
this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5', 10);

// AFTER (correção):
const configuredMax = parseInt(process.env.MAX_ITERATIONS || '30', 10);
this.maxIterations = Math.max(configuredMax, 10); // mínimo 10, nunca 5
console.log(`🔄 MAX_ITERATIONS: ${this.maxIterations}`);
```

**agent-controller.ts:**
Remove overrides que reduzem MAX_ITERATIONS para 5 em skills específicas.

---

## 📊 EXPECTED BEHAVIOR APÓS FIX

### Tarefa Complexa (Exemplo Real):
```
User: "delete arquivo e crie automação systemd"

Iteration 1:
  Tool: vps_execute_command → rm /root/teste.txt
  Result: File deleted

Iteration 2:
  Tool: file_operations → create /root/scripts/notify-boot.sh
  Result: Script created

Iteration 3:
  Tool: vps_execute_command → systemctl daemon-reload
  Result: Service reloaded

Iteration 4:
  Finish: stop (summary response)
  Response: "✅ Deleted teste.txt and created boot notification automation"

Tool Executions: 3 ✅
```

---

## 🚀 IMPLEMENTATION CHECKLIST

- [ ] FIX 1: Rewrite system prompt (imperativo)
- [ ] FIX 2: Add tool-use guardrail (iteration 1 check)
- [ ] FIX 3: Remove structured format template
- [ ] FIX 4: Ensure MAX_ITERATIONS >= 10
- [ ] TEST: "crie arquivo teste.txt" → should still work
- [ ] TEST: "delete arquivo + create automação" → should execute tools
- [ ] VERIFY: `Tool Executions > 0` in logs for complex tasks

---

## 📝 NOTES

**Por que DVACE não tem esse problema:**
1. System prompt é imperativo desde o início
2. Usa sub-agents (AgentTool) para quebrar tarefas complexas
3. Não força formato de resposta estruturado
4. Tool execution é garantida pela arquitetura (coordinator mode)

**Por que só acontece com tarefas complexas:**
- Claude Sonnet 4.5 detecta "múltiplas ações" 
- Entra em "modo planejamento" ao ver formato estruturado
- Acredita que descrever o plano É a resposta esperada
- Tarefas simples (1 ação) não acionam esse modo
