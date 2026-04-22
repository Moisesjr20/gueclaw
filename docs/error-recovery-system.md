# Sistema de Recuperação de Erros - GueClaw Agent

## Visão Geral

O GueClaw Agent agora possui um sistema robusto de recuperação de erros que permite ao usuário retomar tarefas interrompidas por erros recuperáveis (como limite de iterações ou erros temporários).

## Arquitetura

### Componentes Principais

1. **ErrorRecoveryManager** (`src/services/error-recovery-manager.ts`)
   - Gerencia o estado de tarefas interrompidas
   - Armazena histórico de conversação e contexto
   - Controla tentativas de retry (máximo 3)
   - Expira tarefas antigas (24 horas)

2. **Tipos de Erro** (`src/types/errors.ts`)
   - `RecoverableError`: Classe base para erros recuperáveis
   - `MaxIterationsError`: Erro quando o agente atinge limite de iterações
   - Extensível para outros tipos de erro

3. **Interface de Usuário** (`src/handlers/telegram-output-handler.ts`)
   - `sendRecoverableError()`: Envia mensagem de erro com botões inline
   - Botões: "Continue" e "Cancelar"
   - Feedback visual diferenciado por tipo de erro

4. **Handlers de Callback** (`src/index.ts`)
   - `handleCallbackQuery()`: Processa cliques em botões
   - `handleContinueTask()`: Retoma tarefa interrompida
   - `handleCancelTask()`: Cancela e remove tarefa

## Fluxo de Funcionamento

### 1. Erro Ocorre

```typescript
try {
  // Execução do agente...
} catch (error) {
  if (error instanceof MaxIterationsError) {
    // Salva contexto e mostra botão Continue
  }
}
```

### 2. Salvamento de Estado

```typescript
const taskId = recoveryManager.saveInterruptedTask({
  userId: input.userId,
  chatId: input.chatId,
  conversationId: conversation.id,
  errorType: 'MAX_ITERATIONS',
  errorMessage: error.message,
  conversationHistory: history,
  attemptedTools: 'tool1, tool2',
});
```

### 3. Exibição de Erro com Botão

```
🔄 Erro Recuperável: I apologize, but I reached the maximum number of reasoning steps...

💡 Dica: Tente dividir a tarefa em passos menores ou clique em Continue para tentar novamente.

[🔄 Continue] [❌ Cancelar]
```

### 4. Usuário Clica em "Continue"

```typescript
handleContinueTask(ctx, taskId)
  → Recupera histórico de conversação
  → Restaura estado
  → Re-executa tarefa
  → Remove taskId se bem-sucedido
```

## Tipos de Erro Suportados

### MAX_ITERATIONS
- **Causa**: Agente atinge limite de 10 iterações
- **Recuperação**: Tenta novamente com contexto completo
- **Limite**: 3 tentativas
- **Emoji**: 🔄

### UNEXPECTED_ERROR
- **Causa**: Erro inesperado no código
- **Recuperação**: Retry automático
- **Limite**: 3 tentativas
- **Emoji**: ❌

### TOOL_ERROR
- **Causa**: Falha na execução de ferramenta
- **Recuperação**: Retry com validação adicional
- **Limite**: 3 tentativas
- **Emoji**: ⚠️

## Limites e Expiração

- **Máximo de Retries**: 3 tentativas por tarefa
- **Expiração de Tarefa**: 24 horas
- **Armazenamento**: JSON em `data/recovery/interrupted-tasks.json`

## Scripts de Manutenção

### Mapear Logs de Erro

```bash
npm run errors:map
```

Analisa logs e tarefas interrompidas, gerando relatório com:
- Total de erros por tipo
- 5 erros mais recentes de cada tipo
- Recomendações de correção

### Limpar Tarefas Expiradas

```bash
npm run errors:cleanup
```

Remove tarefas com mais de 24 horas automaticamente.

## Exemplo de Uso

### Do Ponto de Vista do Usuário

```
User: "Liste todos os containers Docker, verifique logs de cada um, 
analise uso de memória, gere relatório completo com gráficos"

Bot: 🔄 Erro Recuperável: I apologize, but I reached the maximum 
number of reasoning steps (10) before completing the task.

What I was trying to do:
I wanted to execute: docker_list, docker_logs, analyze_memory, generate_report

💡 Dica: Tente dividir a tarefa em passos menores ou clique em 
Continue para tentar novamente.

[🔄 Continue] [❌ Cancelar]

User: *clica em Continue*

Bot: 🔄 Retomando tarefa com contexto recuperado...
     [executa tarefa com sucesso]
```

## Monitoramento

### Estatísticas de Recuperação

```typescript
const stats = ErrorRecoveryManager.getInstance().getStats();
// {
//   total: 5,
//   byType: { MAX_ITERATIONS: 3, UNEXPECTED_ERROR: 2 },
//   avgRetries: 1.2
// }
```

### Logs

Todos os eventos de recuperação são logados:

```
💾 Saved interrupted task: recovery_123_456_1234567890 (retry: 0/3)
🔄 Restoring 15 messages from saved state
✅ Task resumed successfully
🗑️ Deleted task: recovery_123_456_1234567890
```

## Integração com Sistema Existente

### MemoryManager

O sistema recupera e restaura:
- Histórico completo de conversação
- Mensagens de usuário e assistente
- Contexto de skills utilizadas

### TraceRepository

Eventos de MAX_ITERATIONS são registrados:

```typescript
{
  conversationId: '...',
  iteration: 10,
  toolName: 'MAX_ITERATIONS_ABORT',
  toolArgs: JSON.stringify({ attemptedTools }),
  toolResult: 'Aborted due to max iterations limit',
}
```

### SkillExecutor

Skills podem lançar `RecoverableError` para permitir retry:

```typescript
throw new RecoverableError(
  'Skill execution failed temporarily',
  'TOOL_ERROR',
  'skill_name'
);
```

## Segurança

- ✅ Validação de userId e chatId
- ✅ Tarefas são isoladas por usuário
- ✅ Expiração automática após 24h
- ✅ Limite de tentativas (3x)
- ✅ Sem exposição de stack traces ao usuário

## Melhorias Futuras

1. **Análise Preditiva**
   - Detectar padrões de erro antes que ocorram
   - Sugerir divisão automática de tarefas complexas

2. **Retry Inteligente**
   - Ajustar estratégia baseado no tipo de erro
   - Aumentar timeout para operações lentas

3. **Dashboard**
   - Interface web para visualizar erros
   - Gráficos de tendência
   - Alertas automáticos

4. **Checkpoint Automático**
   - Salvar progresso a cada N iterações
   - Permitir retomar do último checkpoint

## Referências

- [Telegram Bot API - Inline Keyboards](https://core.telegram.org/bots/features#inline-keyboards)
- [Error Handling Best Practices](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Exponential Backoff Strategy](https://en.wikipedia.org/wiki/Exponential_backoff)
