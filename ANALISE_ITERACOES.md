# Análise: Limitação de 5 Iterações do GueClaw

## 🔍 Problema Identificado

O bot está atingindo o limite de **5 iterações** e retornando a mensagem:
> "Atingi o limite de 5 iterações sem chegar a uma resposta final."

### Causa Raiz
No arquivo `src/engine/AgentLoop.ts` (linha 17):
```typescript
this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5');
```

O valor padrão é **5 iterações**, que é muito baixo para tarefas complexas que envolvem:
- Sub-agentes em background
- Verificação de status de processos assíncronos
- Múltiplas chamadas de ferramentas encadeadas
- Scraping e processamento de dados

---

## 🎯 Melhorias Propostas

### 1. **Aumentar MAX_ITERATIONS (Solução Imediata)**

**Arquivo: `.env`**
```env
MAX_ITERATIONS=20  # Era 5, aumentar para 20-30 dependendo da complexidade
```

**Justificativa:**
- DeepSeek e outros modelos modernos precisam de mais iterações para tarefas complexas
- Sub-agentes precisam de múltiplas verificações de status
- Operações assíncronas (scraping, processamento) exigem mais ciclos

**Recomendação:**
- Tarefas simples: 10-15 iterações
- Tarefas complexas (sub-agentes, scraping): 20-30 iterações
- Tarefas muito complexas: 40-50 iterações

---

### 2. **Implementar Modo Adaptativo (Melhoria Avançada)**

Criar um sistema que ajusta dinamicamente o número de iterações baseado no tipo de tarefa:

**Arquivo: `src/engine/AgentLoop.ts`**
```typescript
export class AgentLoop {
  private maxIterations: number;
  private baseIterations: number;
  
  constructor(registry: ToolRegistry, options?: { 
    providerName?: string; 
    modelOverride?: string;
    taskComplexity?: 'simple' | 'medium' | 'complex' | 'background'
  }) {
    this.baseIterations = parseInt(process.env.MAX_ITERATIONS || '20');
    
    // Ajuste dinâmico baseado na complexidade
    const complexityMultipliers = {
      simple: 1,      // 20 iterações
      medium: 1.5,    // 30 iterações
      complex: 2,     // 40 iterações
      background: 3   // 60 iterações (sub-agentes)
    };
    
    const multiplier = complexityMultipliers[options?.taskComplexity || 'medium'];
    this.maxIterations = Math.floor(this.baseIterations * multiplier);
    
    console.log(`[AgentLoop] Max iterations: ${this.maxIterations} (complexity: ${options?.taskComplexity || 'medium'})`);
  }
}
```

---

### 3. **Sistema de Early Exit Inteligente**

Adicionar detecção de loops infinitos e permitir saída antecipada quando não há progresso:

**Arquivo: `src/engine/AgentLoop.ts`**
```typescript
public async run(
  history: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  let iterations = 0;
  let lastToolCalls: string[] = [];
  let repeatCount = 0;
  const MAX_REPEATS = 3; // Se repetir a mesma ação 3x, interrompe
  
  while (iterations < this.maxIterations) {
    iterations++;
    
    // ... código existente de inferência ...
    
    // Detectar loop infinito
    if (response.toolCalls && response.toolCalls.length > 0) {
      const currentTools = response.toolCalls.map(c => c.name).sort().join(',');
      
      if (lastToolCalls.includes(currentTools)) {
        repeatCount++;
        if (repeatCount >= MAX_REPEATS) {
          console.warn('[AgentLoop] Loop detectado - mesma ação repetida 3x');
          return 'Detectei um loop na execução. Por favor, reformule sua solicitação ou forneça mais contexto.';
        }
      } else {
        repeatCount = 0;
      }
      
      lastToolCalls.push(currentTools);
      if (lastToolCalls.length > 5) lastToolCalls.shift(); // Mantém histórico de 5
    }
  }
  
  return `Atingi o limite de ${this.maxIterations} iterações. Última ação: ${lastToolCalls[lastToolCalls.length - 1] || 'nenhuma'}`;
}
```

---

### 4. **Progresso Visual para Usuário**

Informar o usuário sobre o progresso em tarefas longas:

**Arquivo: `src/engine/AgentLoop.ts`**
```typescript
// Adicionar callback de progresso
private progressCallback?: (iteration: number, maxIterations: number, action: string) => void;

constructor(registry: ToolRegistry, options?: { 
  // ... opções existentes ...
  onProgress?: (iteration: number, maxIterations: number, action: string) => void
}) {
  // ... código existente ...
  this.progressCallback = options?.onProgress;
}

// No loop principal:
while (iterations < this.maxIterations) {
  iterations++;
  
  if (this.progressCallback && iterations % 5 === 0) {
    this.progressCallback(iterations, this.maxIterations, 'Processando...');
  }
  
  // ... resto do código ...
}
```

**Uso no AgentController:**
```typescript
const agentLoop = new AgentLoop(this.defaultRegistry, {
  onProgress: (iter, max, action) => {
    if (iter % 5 === 0) {
      ctx.replyWithChatAction('typing');
    }
  }
});
```

---

### 5. **Configurações Específicas por Skill**

Permitir que cada skill defina seu próprio limite de iterações:

**Arquivo: `src/skills/SkillRouter.ts`**
```typescript
export interface Skill {
  name: string;
  content: string;
  maxIterations?: number; // Novo campo opcional
}
```

**Arquivo: `.agents/skills/advocacia-ce-scraper/skill.yaml`**
```yaml
name: advocacia-ce-scraper
description: "Scraper para Diário Oficial CE"
max_iterations: 30  # Scraping precisa de mais iterações
directive: |
  Você é especializado em scraping...
```

---

## 📊 Comparação: DeepSeek vs GueClaw Atual

| Característica | DeepSeek (Anterior) | GueClaw (Atual) | GueClaw (Proposto) |
|----------------|---------------------|-----------------|-------------------|
| Max Iterações  | ~50-100 (estimado)  | 5 (muito baixo) | 20-50 (adaptativo) |
| Loop Detection | ✅ Sim              | ❌ Não          | ✅ Sim (proposto) |
| Progress Feedback | ✅ Sim           | ❌ Não          | ✅ Sim (proposto) |
| Task-Specific Limits | ❌ Não        | ❌ Não          | ✅ Sim (proposto) |

---

## 🚀 Implementação Recomendada (Prioridades)

### **Fase 1: Quick Fix (Imediato - 2 minutos)**
1. Alterar `.env`: `MAX_ITERATIONS=25`
2. Reiniciar o bot

### **Fase 2: Melhorias Básicas (1-2 horas)**
1. Implementar sistema adaptativo (Melhoria #2)
2. Adicionar detecção de loop infinito (Melhoria #3)

### **Fase 3: Melhorias Avançadas (4-6 horas)**
1. Callback de progresso (Melhoria #4)
2. Configurações por skill (Melhoria #5)
3. Testes com diferentes cenários

---

## 🧪 Testes Sugeridos

Após implementar as melhorias, testar com:

1. **Tarefa simples:** "qual é a capital do Brasil?" (deve usar ~2-3 iterações)
2. **Tarefa média:** "liste os arquivos do projeto e resuma" (deve usar ~8-12 iterações)
3. **Tarefa complexa:** "crie um sub-agente para scraping com --sample 5" (deve usar ~15-25 iterações)
4. **Loop infinito:** Comando inválido repetidamente (deve detectar e abortar)

---

## 📝 Alterações nos Arquivos

### Arquivos a modificar:
1. ✅ `.env` - Aumentar MAX_ITERATIONS
2. ✅ `src/engine/AgentLoop.ts` - Implementar melhorias
3. ✅ `src/core/AgentController.ts` - Integrar callbacks de progresso
4. ✅ `.env.example` - Documentar novo valor padrão
5. ⚠️ `src/skills/SkillRouter.ts` - Suporte a max_iterations por skill (opcional)

---

## 💡 Exemplo de Uso

**Antes (5 iterações):**
```
[ReAct] Iteração 1 de 5... [spawn_sub_agent]
[ReAct] Iteração 2 de 5... [get_sub_agent_status] (running)
[ReAct] Iteração 3 de 5... [get_sub_agent_status] (running)
[ReAct] Iteração 4 de 5... [get_sub_agent_status] (running)
[ReAct] Iteração 5 de 5... [get_sub_agent_status] (running)
❌ "Atingi o limite de 5 iterações sem chegar a uma resposta final."
```

**Depois (25 iterações + loop detection):**
```
[ReAct] Iteração 1 de 25... [spawn_sub_agent]
[ReAct] Iteração 2 de 25... [get_sub_agent_status] (running)
[ReAct] Iteração 3 de 25... [get_sub_agent_status] (running)
...
[ReAct] Iteração 12 de 25... [get_sub_agent_status] (completed)
[ReAct] Iteração 13 de 25... [generate_sub_agent_report]
✅ "Sub-agente completou com sucesso! Aqui está o relatório..."
```

---

## 🎓 Lições Aprendidas

1. **Context Window ≠ Iteration Limit:** Modelos modernos têm contexto grande mas precisam de múltiplas iterações para raciocínio complexo
2. **Async Tasks:** Sub-agentes e operações background precisam de polling, que consome iterações
3. **Tool Chaining:** Cada tool call = 1 iteração, tarefas complexas precisam 10-20 calls
4. **Safety vs Usability:** 5 iterações é muito conservador, 20-30 é o sweet spot

---

## 📚 Referências

- ReAct Pattern: https://arxiv.org/abs/2210.03629
- Agent Loop Best Practices: https://docs.anthropic.com/claude/docs/agent-loops
- DeepSeek Documentation: https://platform.deepseek.com/api-docs/
