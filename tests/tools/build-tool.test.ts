import { describe, it, expect } from '@jest/globals';
import { buildTool, z } from '../../src/tools/core';

describe('buildTool Factory', () => {
  describe('Tool Creation', () => {
    it('should create a valid tool instance', () => {
      const tool = buildTool({
        name: 'test_tool',
        description: 'A test tool',
        parameters: z.object({
          input: z.string(),
        }),
        execute: async (args, { success }) => success(args.input),
      });

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
      expect(typeof tool.execute).toBe('function');
      expect(typeof tool.getDefinition).toBe('function');
    });

    it('should generate correct tool definition', () => {
      const tool = buildTool({
        name: 'echo',
        description: 'Echoes input',
        parameters: z.object({
          text: z.string().describe('Text to echo'),
          uppercase: z.boolean().optional().describe('Convert to uppercase'),
        }),
        execute: async (args, { success }) => success(args.text),
      });

      const definition = tool.getDefinition();

      expect(definition.name).toBe('echo');
      expect(definition.description).toBe('Echoes input');
      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.properties.text).toBeDefined();
      expect(definition.parameters.properties.uppercase).toBeDefined();
      expect(definition.parameters.required).toEqual(['text']);
    });
  });

  describe('Argument Validation', () => {
    it('should validate required arguments', async () => {
      const tool = buildTool({
        name: 'test',
        description: 'Test',
        parameters: z.object({
          required: z.string(),
        }),
        execute: async (args, { success }) => success('ok'),
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.error).toContain('required');
    });

    it('should validate argument types', async () => {
      const tool = buildTool({
        name: 'test',
        description: 'Test',
        parameters: z.object({
          count: z.number(),
        }),
        execute: async (args, { success }) => success('ok'),
      });

      const result = await tool.execute({ count: 'not a number' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should validate enum values', async () => {
      const tool = buildTool({
        name: 'test',
        description: 'Test',
        parameters: z.object({
          status: z.enum(['active', 'inactive']),
        }),
        execute: async (args, { success }) => success('ok'),
      });

      const result = await tool.execute({ status: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should pass validation for valid arguments', async () => {
      const tool = buildTool({
        name: 'test',
        description: 'Test',
        parameters: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
        execute: async (args, { success }) => success(`Hello ${args.name}`),
      });

      const result = await tool.execute({ name: 'Alice' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello Alice');
    });
  });

  describe('Tool Execution', () => {
    it('should execute successfully with valid args', async () => {
      const tool = buildTool({
        name: 'multiply',
        description: 'Multiply numbers',
        parameters: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async (args, { success }) => {
          const result = args.a * args.b;
          return success(`Result: ${result}`, { result });
        },
      });

      const result = await tool.execute({ a: 5, b: 3 });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Result: 15');
      expect(result.metadata?.result).toBe(15);
    });

    it('should handle errors with error helper', async () => {
      const tool = buildTool({
        name: 'divide',
        description: 'Divide numbers',
        parameters: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async (args, { success, error }) => {
          if (args.b === 0) {
            return error('Cannot divide by zero');
          }
          return success(`Result: ${args.a / args.b}`);
        },
      });

      const result = await tool.execute({ a: 10, b: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot divide by zero');
    });

    it('should catch execution exceptions', async () => {
      const tool = buildTool({
        name: 'error_tool',
        description: 'Always throws',
        parameters: z.object({}),
        execute: async () => {
          throw new Error('Intentional error');
        },
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution error');
      expect(result.error).toContain('Intentional error');
    });
  });

  describe('Type Safety', () => {
    it('should provide typed arguments in execute', async () => {
      const tool = buildTool({
        name: 'typed_tool',
        description: 'Test type safety',
        parameters: z.object({
          name: z.string(),
          age: z.number(),
          active: z.boolean(),
        }),
        execute: async (args, { success }) => {
          // TypeScript should know the exact types here
          const nameLength: number = args.name.length; // string
          const doubled: number = args.age * 2; // number
          const status: boolean = args.active; // boolean

          return success(`${nameLength},${doubled},${status}`);
        },
      });

      const result = await tool.execute({
        name: 'Alice',
        age: 30,
        active: true,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('5,60,true');
    });
  });

  describe('Complex Schemas', () => {
    it('should handle nested objects', async () => {
      const tool = buildTool({
        name: 'nested',
        description: 'Nested schema',
        parameters: z.object({
          user: z.object({
            name: z.string(),
            email: z.string(),
          }),
        }),
        execute: async (args, { success }) => {
          return success(`${args.user.name} <${args.user.email}>`);
        },
      });

      const result = await tool.execute({
        user: { name: 'Alice', email: 'alice@example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Alice <alice@example.com>');
    });

    it('should handle arrays', async () => {
      const tool = buildTool({
        name: 'array_tool',
        description: 'Array schema',
        parameters: z.object({
          items: z.array(z.string()),
        }),
        execute: async (args, { success }) => {
          return success(args.items.join(', '));
        },
      });

      const result = await tool.execute({
        items: ['apple', 'banana', 'orange'],
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple, banana, orange');
    });
  });
});
