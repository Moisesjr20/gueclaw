# Command System Architecture

**Status:** ✅ Implemented (DVACE Phase 1)  
**Version:** 1.0  
**Last Updated:** April 13, 2026

---

## Overview

O **Command System** é o primeiro componente da arquitetura DVACE, projetado para separar comandos de execução imediata (LocalCommand) de comandos que requerem processamento pelo LLM (PromptCommand).

### Problema Resolvido

**Antes:**
```
User: /status
→ Mensagem vai para LLM
→ LLM processa e responde
→ ❌ Latência desnecessária + custo de tokens
```

**Depois (Command System):**
```
User: /status
→ CommandRegistry detecta LocalCommand
→ Executa handler diretamente
→ ✅ Resposta instantânea (< 100ms)
```

---

## Arquitetura

### 1. Tipos de Comando

#### LocalCommand
Executa imediatamente sem passar pelo LLM.

```typescript
interface LocalCommand {
  type: 'local';
  name: string;
  description: string;
  handler: (args?: string) => Promise<string>;
  aliases?: string[];
}
```

**Exemplos:**
- `/start` - Mensagem de boas-vindas
- `/help` - Listar comandos disponíveis
- `/status` - Status do sistema
- `/version` - Versão do GueClaw

**Características:**
- ⚡ Execução instantânea (< 100ms)
- 💰 Zero custo de tokens
- 🔒 Não acessa LLM

#### PromptCommand
Instrui o LLM com um system prompt e ferramentas específicas.

```typescript
interface PromptCommand {
  type: 'prompt';
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];  // ← Restrições de segurança
  aliases?: string[];
}
```

**Exemplos:**
- `/review` - Code review sem modificar código
- `/commit` - Criar commit git
- `/deploy` - Deploy no VPS
- `/security` - Scan de segurança

**Características:**
- 🧠 Passa pelo Agent Loop (LLM)
- 🛠️ Acessa ferramentas específicas
- 🔒 Restringe ferramentas via `allowedTools`

#### ToolCommand
Wrapper para ferramentas executáveis (deprecated - removido na refatoração).

---

### 2. Command Registry

Gerenciador centralizado de comandos.

```typescript
class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  
  /**
   * Registra um comando no sistema
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
    
    // Registrar aliases
    if (command.aliases) {
      command.aliases.forEach(alias => {
        this.commands.set(alias, command);
      });
    }
  }
  
  /**
   * Busca comando por nome ou alias
   */
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }
  
  /**
   * Verifica se comando existe
   */
  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }
  
  /**
   * Lista todos os comandos registrados
   */
  listCommands(): Command[] {
    const uniqueCommands = new Map<string, Command>();
    
    for (const [name, cmd] of this.commands) {
      if (!uniqueCommands.has(cmd.name)) {
        uniqueCommands.set(cmd.name, cmd);
      }
    }
    
    return Array.from(uniqueCommands.values());
  }
}
```

**Singleton Pattern:**
```typescript
export const commandRegistry = new CommandRegistry();
```

---

### 3. AllowedTools Patterns

Sistema de padrões para controlar quais ferramentas o LLM pode usar.

#### Exact Match
```typescript
allowedTools: ['FileRead', 'grep_search', 'semantic_search']
// ✅ Permite: FileRead
// ❌ Bloqueia: FileWrite, Bash, SSHExec
```

#### Wildcards
```typescript
allowedTools: ['FileRead(*)', 'Bash(git *)']
// ✅ Permite: FileRead(qualquer path)
// ✅ Permite: Bash(git status), Bash(git log)
// ❌ Bloqueia: Bash(rm -rf)
```

#### Negation (Blacklist)
```typescript
allowedTools: ['Bash(*)', '!Bash(rm *)', '!Bash(sudo *)']
// ✅ Permite: Bash(ls), Bash(cat file.txt)
// ❌ Bloqueia: Bash(rm -rf /), Bash(sudo apt install)
```

#### Combined Patterns
```typescript
allowedTools: [
  'FileRead(*)',      // Permite: Leitura de qualquer arquivo
  'grep_search',      // Permite: Busca em arquivos
  'Bash(git *)',      // Permite: Apenas comandos git
  '!Bash(git push)',  // Bloqueia: git push específico
  '!FileWrite(*)',    // Bloqueia: Escrita de arquivos
  '!SSHExec(*)'       // Bloqueia: Qualquer comando SSH
]
```

#### Wildcard Total (Free Conversation)
```typescript
allowedTools: ['*']
// ✅ Permite: TODAS as ferramentas
// Usado em conversação livre (sem comando específico)
```

---

### 4. Pattern Matching Algorithm

```typescript
function canUseTool(toolCall: string, allowedTools: string[]): boolean {
  // Wildcard total → permite tudo
  if (allowedTools.includes('*')) {
    return true;
  }
  
  // Verificar negations primeiro (prioridade máxima)
  for (const pattern of allowedTools) {
    if (!pattern.startsWith('!')) continue;
    
    const negatedPattern = pattern.substring(1);
    if (matchesPattern(toolCall, negatedPattern)) {
      return false;  // ❌ Bloqueado por negation
    }
  }
  
  // Verificar allow patterns
  for (const pattern of allowedTools) {
    if (pattern.startsWith('!')) continue;
    
    if (matchesPattern(toolCall, pattern)) {
      return true;  // ✅ Permitido
    }
  }
  
  return false;  // ❌ Não encontrado em allowedTools
}

function matchesPattern(toolCall: string, pattern: string): boolean {
  // Exact match
  if (pattern === toolCall) {
    return true;
  }
  
  // Wildcard match: "FileRead(*)"
  if (pattern.endsWith('(*)')) {
    const toolName = pattern.substring(0, pattern.length - 3);
    return toolCall.startsWith(toolName + '(');
  }
  
  // Argument pattern match: "Bash(git *)"
  if (pattern.includes('(') && pattern.endsWith('*)')) {
    const [toolName, argPattern] = pattern.split('(');
    const argPatternClean = argPattern.substring(0, argPattern.length - 2);
    
    if (!toolCall.startsWith(toolName + '(')) {
      return false;
    }
    
    const args = toolCall.substring(toolName.length + 1, toolCall.length - 1);
    return args.startsWith(argPatternClean);
  }
  
  return false;
}
```

---

## Exemplos Práticos

### Exemplo 1: LocalCommand (/status)

```typescript
commandRegistry.register({
  type: 'local',
  name: '/status',
  description: 'Show system status',
  handler: async () => {
    const tasks = taskTracker.getPendingTasks();
    const stats = stateManager.getStats();
    
    return `
📊 **GueClaw Status**

🔢 Active Tasks: ${tasks.length}
📝 Total Tasks: ${stats.totalTasks}
✅ Completed: ${stats.completedTasks}
❌ Failed: ${stats.failedTasks}
⏳ In Progress: ${stats.inProgressTasks}
    `.trim();
  }
});
```

**Fluxo de Execução:**
```
User: /status
  ↓
TelegramHandler.handleCommand()
  ↓
CommandRegistry.get('/status')
  ↓
LocalCommand.handler()
  ↓
Resposta instantânea
```

### Exemplo 2: PromptCommand (/review)

```typescript
commandRegistry.register({
  type: 'prompt',
  name: '/review',
  description: 'Code review without modifying anything',
  systemPrompt: `
You are a senior code reviewer. Analyze the code and provide:
1. Code quality assessment
2. Potential bugs or issues
3. Suggestions for improvement

IMPORTANT: You can ONLY read files. Do NOT modify anything.
  `.trim(),
  allowedTools: [
    'FileRead(*)',
    'grep_search',
    'semantic_search',
    '!FileWrite(*)',
    '!Bash(*)',
    '!SSHExec(*)'
  ]
});
```

**Fluxo de Execução:**
```
User: /review src/core/agent-loop.ts
  ↓
TelegramHandler.handleCommand()
  ↓
CommandRegistry.get('/review')
  ↓
AgentLoop.run(userMessage, systemPrompt, allowedTools)
  ↓
LLM recebe system prompt
  ↓
LLM tenta chamar FileRead(src/core/agent-loop.ts) → ✅ PERMITIDO
  ↓
LLM tenta chamar FileWrite(...) → ❌ BLOQUEADO (PERMISSION DENIED)
  ↓
LLM retorna análise
```

### Exemplo 3: PromptCommand (/commit)

```typescript
commandRegistry.register({
  type: 'prompt',
  name: '/commit',
  description: 'Create a git commit',
  systemPrompt: `
Create a professional git commit following conventional commits:

1. Check git status
2. Review staged changes
3. Create a descriptive commit message
4. Execute git commit

Commit format: <type>(<scope>): <description>

Types: feat, fix, docs, refactor, test, chore
  `.trim(),
  allowedTools: [
    'Bash(git status)',
    'Bash(git diff *)',
    'Bash(git add *)',
    'Bash(git commit *)',
    '!Bash(git push)',    // Bloqueia push (segurança)
    '!Bash(rm *)',        // Bloqueia comandos destrutivos
    '!Bash(sudo *)',
    'FileRead(*)',        // Permite ler arquivos para contexto
    '!FileWrite(*)'       // Bloqueia escrita
  ]
});
```

**Fluxo de Execução:**
```
User: /commit
  ↓
AgentLoop com allowedTools restritas
  ↓
LLM: Bash(git status) → ✅ PERMITIDO
  Result: "modified: src/index.ts"
  ↓
LLM: FileRead(src/index.ts) → ✅ PERMITIDO
  Result: <conteúdo do arquivo>
  ↓
LLM: Bash(git add src/index.ts) → ✅ PERMITIDO
  ↓
LLM: Bash(git commit -m "feat: add new feature") → ✅ PERMITIDO
  ↓
LLM: Bash(git push) → ❌ BLOQUEADO (PERMISSION DENIED)
  ↓
Commit criado, push bloqueado
```

---

## Validação e Testes

### Unit Tests (27 testes)

```typescript
// tests/unit/tool-permissions.test.ts

describe('Tool Permissions', () => {
  test('exact match allows tool', () => {
    expect(canUseTool('FileRead', ['FileRead'])).toBe(true);
  });
  
  test('wildcard allows any argument', () => {
    expect(canUseTool('FileRead(/path/file.txt)', ['FileRead(*)'])).toBe(true);
  });
  
  test('argument pattern matches', () => {
    expect(canUseTool('Bash(git status)', ['Bash(git *)'])).toBe(true);
    expect(canUseTool('Bash(rm -rf)', ['Bash(git *)'])).toBe(false);
  });
  
  test('negation blocks tool', () => {
    expect(canUseTool('Bash(rm -rf)', ['Bash(*)', '!Bash(rm *)'])).toBe(false);
  });
  
  test('negation has priority over allow', () => {
    expect(canUseTool('SSHExec(whoami)', ['*', '!SSHExec(*)'])).toBe(false);
  });
});
```

### Integration Tests (9 testes)

```typescript
// tests/integration/phase-1-validation.test.ts

describe('Command System Integration', () => {
  test('LocalCommand executes without LLM', async () => {
    const result = await commandRegistry.get('/status')!.handler();
    
    expect(result).toContain('GueClaw Status');
    expect(result).not.toContain('LLM');
  });
  
  test('PromptCommand enforces allowedTools', async () => {
    const cmd = commandRegistry.get('/review') as PromptCommand;
    
    expect(cmd.allowedTools).toContain('FileRead(*)');
    expect(cmd.allowedTools).toContain('!FileWrite(*)');
  });
});
```

---

## Best Practices

### 1. Segurança em PromptCommands

**✅ Bom:**
```typescript
{
  name: '/deploy',
  allowedTools: [
    'Bash(git pull)',
    'Bash(npm install)',
    'Bash(pm2 restart *)',
    '!Bash(rm *)',
    '!Bash(sudo *)',
    '!SSHExec(*)'
  ]
}
```

**❌ Ruim:**
```typescript
{
  name: '/deploy',
  allowedTools: ['*']  // ⚠️ Permite TUDO (perigoso!)
}
```

### 2. System Prompts Claros

**✅ Bom:**
```typescript
systemPrompt: `
You are a code reviewer. Your task:
1. Read the specified files
2. Analyze code quality
3. Provide suggestions

RESTRICTIONS:
- You can ONLY read files (FileRead)
- Do NOT modify anything
- Do NOT execute bash commands
`.trim()
```

**❌ Ruim:**
```typescript
systemPrompt: "Review the code"  // ⚠️ Muito vago
```

### 3. LocalCommand para Operações Simples

**✅ Bom:**
```typescript
// Status do sistema → LocalCommand (instantâneo)
{
  type: 'local',
  name: '/ping',
  handler: async () => 'Pong! 🏓'
}
```

**❌ Ruim:**
```typescript
// Status do sistema → PromptCommand (lento e caro)
{
  type: 'prompt',
  systemPrompt: 'Say pong',
  allowedTools: []
}
```

---

## Próximos Passos

1. **Adicionar mais LocalCommands** para operações frequentes
2. **Criar PromptCommands especializados** para workflows comuns
3. **Implementar rate limiting** em comandos sensíveis
4. **Adicionar audit log** de execuções de comando

---

## Referências

- [CHECKLIST-DVACE-REFACTOR.md](../../CHECKLIST-DVACE-REFACTOR.md) - Phase 1
- [src/types/command-types.ts](../../src/types/command-types.ts) - Definições de tipos
- [src/core/command-registry.ts](../../src/core/command-registry.ts) - Implementação
- [tests/unit/tool-permissions.test.ts](../../tests/unit/tool-permissions.test.ts) - Unit tests
- [tests/integration/phase-1-validation.test.ts](../../tests/integration/phase-1-validation.test.ts) - Integration tests
