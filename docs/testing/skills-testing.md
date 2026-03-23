# Estratégia de Testes de Skills

**Framework:** Jest + ts-jest
**Localização dos testes:** `tests/unit/` e `tests/e2e/`

---

## 1. Visão Geral

O GueClaw tem dois tipos de testes:

| Tipo | Localização | O que cobre | Velocidade |
|---|---|---|---|
| **Unit** | `tests/unit/` | Classes isoladas com mocks | < 1s por arquivo |
| **E2E** | `tests/e2e/` | Fluxo completo (AgentLoop + tools + mock provider) | 2-5s por arquivo |

```bash
# Rodar todos os testes
npm test

# Apenas unitários
npm run test:unit

# Apenas e2e
npm run test:e2e

# Watch mode
npm run test:watch

# Com coverage
npx jest --coverage
```

---

## 2. Testes Existentes

### Unit Tests (`tests/unit/`)

| Arquivo | O que testa |
|---|---|
| `tool-registry.test.ts` | Registro, lookup, listagem e desregistro de tools |
| `memory-manager.test.ts` | MemoryManager: salvar/ler conversas no SQLite (mock) |
| `memory-write-tool.test.ts` | Tool de escrita de memória (arquivos em disco) |
| `persistent-memory.test.ts` | PersistentMemory: leitura de arquivos `.md` de memória |
| `heartbeat.test.ts` | HeartbeatService: geração de heartbeats periódicos |
| `read-skill-tool.test.ts` | ReadSkillTool: leitura de SKILL.md de skills registradas |
| `security-validators.test.ts` | Sanitização de paths, injeção de comandos, SSRF |
| `analyze-image-tool.test.ts` | Tool de análise de imagem via provider LLM |
| `audio-tool.test.ts` | Tool de transcrição de áudio |

### E2E Tests (`tests/e2e/`)

| Arquivo | O que testa |
|---|---|
| `agent-loop.test.ts` | Loop ReAct completo: thought → tool_call → result → stop |
| `dialog-api.test.ts` | Endpoints da Debug API (simulate, logs, stats, trace) |

---

## 3. Infraestrutura de Mocks

### 3.1 SQLite Mock (`__mocks__/better-sqlite3.js`)

O `jest.config.js` redireciona `better-sqlite3` para um mock em memória. Todos os testes de banco rodam sem arquivo físico, sem state entre execuções.

```javascript
// Configurado automaticamente — não precisa de setup nos testes
// Ver: jest.config.js → moduleNameMapper
```

### 3.2 Mock de LLM Provider

```typescript
import { ILLMProvider, CompletionOptions } from '../../src/core/providers/base-provider';
import { Message, LLMResponse } from '../../src/types';

class MockProvider implements ILLMProvider {
  readonly name = 'mock-provider';
  readonly supportsToolCalls = true;
  readonly supportsStreaming = false;

  async generateCompletion(messages: Message[], _options?: CompletionOptions): Promise<LLMResponse> {
    // Se já tem resultado de tool no histórico → resposta final
    const hasToolResult = messages.some(m => m.role === 'tool');
    if (hasToolResult) {
      return { content: 'Resultado final processado.', finishReason: 'stop' };
    }
    // Primeira iteração → pedir tool
    return {
      content: null,
      finishReason: 'tool_calls',
      toolCalls: [{ id: 'call_1', name: 'calculator', arguments: { operation: 'add', a: 2, b: 3 } }]
    };
  }
}
```

### 3.3 Mock de Tool

```typescript
import { BaseTool } from '../../src/tools/base-tool';
import { ToolDefinition } from '../../src/core/providers/base-provider';
import { ToolResult } from '../../src/types';

class MockTool extends BaseTool {
  readonly name = 'mock_tool';
  readonly description = 'Mock for tests';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] }
    };
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    return this.success(`Echo: ${args.input}`);
  }
}
```

---

## 4. Como Testar uma Nova Skill

Skills são Markdown, não TypeScript — não há teste de skill que "executa o SKILL.md". O que se testa é:

### 4.1 Teste de roteamento (SkillRouter)

Verificar que a `description` do SKILL.md é suficientemente distinta para o LLM rotear corretamente.

```typescript
// tests/unit/skill-router.test.ts (a criar se necessário)
it('routes "liste meus grupos do WhatsApp" to uazapi-groups', async () => {
  const router = new SkillRouter(mockProvider);
  const skills = loadSkillsFromFixtures(['uazapi-groups', 'vps-manager']);
  const result = await router.route('liste meus grupos do WhatsApp', skills);
  expect(result).toBe('uazapi-groups');
});
```

### 4.2 Teste de tools usadas pela skill

Se a skill usa uma tool específica, escreva um unit test para essa tool:

```typescript
// Template: tests/unit/minha-skill-tool.test.ts
import { MinhaSkillTool } from '../../src/tools/minha-skill-tool';

describe('MinhaSkillTool', () => {
  let tool: MinhaSkillTool;

  beforeEach(() => {
    tool = new MinhaSkillTool();
  });

  it('should return success on valid input', async () => {
    const result = await tool.execute({ action: 'listar' });
    expect(result.success).toBe(true);
  });

  it('should return error on missing required arg', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 4.3 Teste de integração manual (Debug API)

Para skills que dependem de APIs externas (UazAPI, Google Calendar), o teste mais prático é via Debug API:

```bash
# 1. Abrir túnel para o VPS
npm run debug:tunnel

# 2. Simular execução da skill
node scripts/debug-api.js simulate "liste meus grupos do WhatsApp"

# 3. Verificar no output:
# - "🎯 Skill roteada: uazapi-groups"  → roteamento correto
# - "✅ RESULTADO: ..."                → execução bem-sucedida
# - Trace mostra as tools chamadas e os resultados
```

---

## 5. Cobertura Mínima Esperada

| Categoria | Cobertura mínima |
|---|---|
| Tools (`src/tools/`) | 80% line coverage |
| Core (`src/core/`) | 70% line coverage |
| Utils (`src/utils/`) | 90% line coverage |

```bash
# Gerar relatório de coverage
npx jest --coverage

# Relatório HTML em: coverage/lcov-report/index.html
```

---

## 6. CI (GitHub Actions)

O workflow `npm run validate` (lint + build + unit tests) roda localmente antes de todo push. Não há pipeline de CI configurado no GitHub ainda.

**Para adicionar CI:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run validate
```

---

## 7. Convenção de Nomenclatura de Testes

```typescript
describe('<NomeDaClasse>', () => {
  describe('<nomeDoMetodo>', () => {
    it('should <resultado esperado> when <condição>', () => { ... });
    it('should return error when <condição de falha>', () => { ... });
  });
});
```

**Exemplo:**
```typescript
describe('ToolRegistry', () => {
  describe('register', () => {
    it('should register a tool successfully', () => { ... });
    it('should throw when registering duplicate name', () => { ... });
  });
});
```
