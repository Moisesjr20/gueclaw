# 🔧 Tool Development Guide

**Última atualização:** 02/04/2026  
**Fase:** 2.4 - buildTool() Factory Pattern  
**Status:** ✅ COMPLETO

---

## 📋 Sumário

1. [Visão Geral](#visão-geral)
2. [buildTool() Factory Pattern](#buildtool-factory-pattern)
3. [Criando sua Primeira Tool](#criando-sua-primeira-tool)
4. [Tipos de Parâmetros com Zod](#tipos-de-parâmetros-com-zod)
5. [Validação e Tratamento de Erros](#validação-e-tratamento-de-erros)
6. [Exemplos Completos](#exemplos-completos)
7. [Migrando Tools Antigas](#migrando-tools-antigas)
8. [Melhores Práticas](#melhores-práticas)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O GueClaw oferece duas formas de criar tools:

### **Método Tradicional** (Class-Based)
- Estende `BaseTool`
- Implementa `getDefinition()` e `execute()` manualmente
- ~80-100 linhas de boilerplate
- Usado em tools pré-existentes

### **buildTool()** Factory Pattern ✨ **RECOMENDADO**
- Factory function simplificada
- Validação automática com Zod
- Type-safe (TypeScript infere tipos automaticamente)
- ~40-50 linhas (50% menos código!)
- **Use para todas as novas tools**

---

## 🏭 buildTool() Factory Pattern

### Arquitetura

```
src/tools/core/
├── build-tool.ts         - Factory principal
├── schema-converter.ts   - Converte Zod → ToolDefinition
├── types.ts              - Interfaces e tipos
└── index.ts              - Exports convenientes
```

### Como Funciona

1. **Define:** Você define name, description, Zod schema e função execute
2. **Valida:** buildTool() valida automaticamente args com Zod
3. **Converte:** Zod schema é convertido para formato OpenAI-compatible
4. **Executa:** Sua função recebe args tipados + helpers (success/error)

---

## 🚀 Criando sua Primeira Tool

### Exemplo Simples: Greeting Tool

```typescript
import { buildTool, z } from './core';

export const GreetingTool = buildTool({
  name: 'greet',
  description: 'Greet a person by name',

  parameters: z.object({
    name: z
      .string()
      .describe('The name of the person to greet'),
    
    formal: z
      .boolean()
      .optional()
      .describe('Use formal greeting (default: false)'),
  }),

  execute: async (args, { success, error }) => {
    // args são validados e tipados automaticamente
    // TypeScript sabe: args.name é string, args.formal é boolean | undefined

    if (args.name.length === 0) {
      return error('Name cannot be empty');
    }

    const greeting = args.formal
      ? `Good day, ${args.name}.`
      : `Hey, ${args.name}!`;

    return success(greeting);
  },
});
```

### Uso

```typescript
const result = await GreetingTool.execute({ name: 'Alice' });
console.log(result.output); // "Hey, Alice!"

const result2 = await GreetingTool.execute({ name: 'Dr. Smith', formal: true });
console.log(result2.output); // "Good day, Dr. Smith."
```

---

## 🧩 Tipos de Parâmetros com Zod

### String

```typescript
parameters: z.object({
  text: z.string().describe('Input text'),
})
```

### Number

```typescript
parameters: z.object({
  age: z.number().describe('Age in years'),
  count: z.number().int().positive().describe('Count (positive integer)'),
  price: z.number().min(0).max(1000).describe('Price (0-1000)'),
})
```

### Boolean

```typescript
parameters: z.object({
  enabled: z.boolean().describe('Enable feature'),
})
```

### Enum (Seleção Fixa)

```typescript
parameters: z.object({
  status: z
    .enum(['active', 'inactive', 'pending'])
    .describe('Status value'),
})
```

### Array

```typescript
parameters: z.object({
  tags: z
    .array(z.string())
    .describe('List of tags'),
  
  numbers: z
    .array(z.number())
    .min(1)  // Pelo menos 1 elemento
    .max(10) // Máximo 10 elementos
    .describe('Array of numbers'),
})
```

### Object (Nested)

```typescript
parameters: z.object({
  user: z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number().optional(),
  }).describe('User information'),
})
```

### Optional Parameters

```typescript
parameters: z.object({
  required: z.string().describe('This is required'),
  optional: z.string().optional().describe('This is optional'),
  withDefault: z.string().default('default').describe('Has default value'),
})
```

---

## ✅ Validação e Tratamento de Erros

### Validação Automática (Zod)

```typescript
export const AgeTool = buildTool({
  name: 'age_calculator',
  description: 'Calculate age from birth year',

  parameters: z.object({
    birthYear: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .describe('Birth year (1900-present)'),
  }),

  execute: async (args, { success }) => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - args.birthYear;
    return success(`You are ${age} years old`);
  },
});
```

**O que Zod valida:**
- ✅ `birthYear` é número
- ✅ `birthYear` é inteiro
- ✅ `birthYear` >= 1900
- ✅ `birthYear` <= ano atual

**Se validação falhar:**
```typescript
// Entrada inválida
await AgeTool.execute({ birthYear: 'not a number' });
// Retorna erro automático: "Validation error: birthYear: Expected number, received string"

await AgeTool.execute({ birthYear: 1800 });
// Retorna erro: "Validation error: birthYear: Number must be greater than or equal to 1900"
```

### Erros de Business Logic

```typescript
execute: async (args, { success, error }) => {
  // Validar regras de negócio
  if (args.dividend === 0) {
    return error('Cannot divide by zero');
  }

  // Try-catch para erros inesperados
  try {
    const result = performComplexOperation(args);
    return success(result);
  } catch (err) {
    return error(`Operation failed: ${err.message}`);
  }
}
```

---

## 📚 Exemplos Completos

### 1. Calculator Tool

```typescript
export const CalculatorTool = buildTool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',

  parameters: z.object({
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('The operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),

  execute: async (args, { success, error }) => {
    let result: number;

    switch (args.operation) {
      case 'add':
        result = args.a + args.b;
        break;
      case 'subtract':
        result = args.a - args.b;
        break;
      case 'multiply':
        result = args.a * args.b;
        break;
      case 'divide':
        if (args.b === 0) {
          return error('Cannot divide by zero');
        }
        result = args.a / args.b;
        break;
    }

    return success(`Result: ${result}`, {
      operation: args.operation,
      inputs: [args.a, args.b],
      result,
    });
  },

  examples: [
    {
      description: 'Add two numbers',
      args: { operation: 'add', a: 5, b: 3 },
      expectedOutput: 'Result: 8',
    },
  ],
});
```

### 2. Text Transform Tool

```typescript
export const TextTransformTool = buildTool({
  name: 'text_transform',
  description: 'Transform text with various operations',

  parameters: z.object({
    text: z.string().describe('Text to transform'),
    operations: z
      .array(z.enum(['uppercase', 'lowercase', 'reverse', 'trim']))
      .describe('Operations to apply in sequence'),
  }),

  execute: async (args, { success }) => {
    let result = args.text;

    for (const op of args.operations) {
      switch (op) {
        case 'uppercase':
          result = result.toUpperCase();
          break;
        case 'lowercase':
          result = result.toLowerCase();
          break;
        case 'reverse':
          result = result.split('').reverse().join('');
          break;
        case 'trim':
          result = result.trim();
          break;
      }
    }

    return success(result, {
      originalLength: args.text.length,
      finalLength: result.length,
      operationsApplied: args.operations.length,
    });
  },
});
```

### 3. API Call Tool (Async)

```typescript
import axios from 'axios';

export const GitHubUserTool = buildTool({
  name: 'github_user',
  description: 'Fetch GitHub user information',

  parameters: z.object({
    username: z
      .string()
      .min(1)
      .describe('GitHub username'),
  }),

  execute: async (args, { success, error }) => {
    try {
      const response = await axios.get(
        `https://api.github.com/users/${args.username}`
      );

      const { name, bio, public_repos, followers } = response.data;

      const output = `
**${name || args.username}**
${bio || 'No bio'}

📦 Repositories: ${public_repos}
👥 Followers: ${followers}
      `.trim();

      return success(output, {
        username: args.username,
        repos: public_repos,
        followers,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return error(`GitHub user '${args.username}' not found`);
      }
      return error(`Failed to fetch user: ${err.message}`);
    }
  },
});
```

---

## 🔄 Migrando Tools Antigas

### Antes (Método Tradicional)

```typescript
class OldTool extends BaseTool {
  public readonly name = 'my_tool';
  public readonly description = 'Does something';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Input text',
          },
        },
        required: ['input'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (!args.input || typeof args.input !== 'string') {
      return this.error('Invalid input');
    }

    const result = doSomething(args.input);
    return this.success(result);
  }
}
```

### Depois (buildTool)

```typescript
export const MyTool = buildTool({
  name: 'my_tool',
  description: 'Does something',

  parameters: z.object({
    input: z.string().describe('Input text'),
  }),

  execute: async (args, { success }) => {
    const result = doSomething(args.input);
    return success(result);
  },
});
```

**Redução:** ~90 linhas → ~15 linhas (83% menos código!)

---

## ✨ Melhores Práticas

### 1. Use .describe() em Todos os Parâmetros

```typescript
// ❌ Ruim
parameters: z.object({
  name: z.string(),
})

// ✅ Bom
parameters: z.object({
  name: z.string().describe('Full name of the person'),
})
```

### 2. Valide Business Logic no execute()

```typescript
execute: async (args, { success, error }) => {
  // Validação de negócio (Zod valida tipos, você valida lógica)
  if (args.startDate > args.endDate) {
    return error('Start date must be before end date');
  }

  // ... resto da lógica
}
```

### 3. Forneça Metadata Útil

```typescript
return success(output, {
  processingTimeMs: Date.now() - startTime,
  itemsProcessed: items.length,
  cached: cacheHit,
});
```

### 4. Use Enums para Opções Limitadas

```typescript
// ❌ String livre (erro fácil)
status: z.string().describe('Status: active, inactive, pending'),

// ✅ Enum (validado automaticamente)
status: z.enum(['active', 'inactive', 'pending']).describe('Status'),
```

### 5. Documente com Examples

```typescript
export const MyTool = buildTool({
  // ... config

  examples: [
    {
      description: 'Basic usage',
      args: { input: 'test' },
      expectedOutput: 'Processed: test',
    },
    {
      description: 'With options',
      args: { input: 'test', uppercase: true },
      expectedOutput: 'Processed: TEST',
    },
  ],
});
```

---

## ❓ Troubleshooting

### "Tool schema must be a Zod object"

**Problema:** Passou um primitive type ao invés de z.object()

```typescript
// ❌ Errado
parameters: z.string()

// ✅ Correto
parameters: z.object({
  text: z.string(),
})
```

### "Validation error: Required"

**Problema:** Parâmetro obrigatório não foi fornecido

```typescript
// Parâmetro requerido
await MyTool.execute({ /* faltou o parâmetro */ });

// Solução: Marque como opcional se não for obrigatório
parameters: z.object({
  optional: z.string().optional(),
})
```

### Args Não Estão Tipados

**Problema:** TypeScript não está inferindo tipos

```typescript
// ✅ Certifique-se de que execute está recebendo o tipo inferido
execute: async (args, helpers) => {
  // args.input deveria ter autocomplete aqui
  console.log(args.input); // string
}
```

### Tool Não Aparece para o LLM

**Problema:** Tool não foi registrada no ToolRegistry

```typescript
// Registre em src/tools/registry/tool-registry.ts
import { MyTool } from '../my-tool';

export class ToolRegistry {
  private tools: Map<string, BaseTool>;

  constructor() {
    this.tools = new Map();
    this.registerTool(MyTool); // ← Adicione aqui
  }
}
```

---

## 📊 Comparação: Old Way vs buildTool()

| Aspecto | Old Way (Class) | buildTool() |
|---------|-----------------|-------------|
| **Linhas de código** | ~90 linhas | ~40 linhas |
| **Boilerplate** | Alto (getDefinition, constructor, etc) | Mínimo |
| **Type Safety** | Manual (any) | Automático (inferência Zod) |
| **Validação** | Manual | Automática (Zod) |
| **Tempo de desenvolvimento** | ~20-30 min | ~5-10 min |
| **Manutenibilidade** | Médio | Alto |
| **Recomendado para** | Legacy code | **Novas tools (sempre!)** |

---

## 🎓 Recursos Adicionais

- **Zod Documentation:** https://zod.dev
- **Exemplos no Código:**
  - `src/tools/echo-tool.ts` - Exemplo completo
  - `src/tools/BUILDTOOL-COMPARISON.ts` - Comparação Old vs New
  - `tests/tools/build-tool.test.ts` - Testes de referência

---

**Criado por:** GueClaw Team  
**License:** Uso interno  
**Última revisão:** 02/04/2026 (Fase 2.4)
