import { AgentLoop } from '../../src/core/agent-loop/agent-loop';
import { ILLMProvider } from '../../src/core/providers/base-provider';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { BaseTool } from '../../src/tools/base-tool';
import { ToolDefinition } from '../../src/core/providers/base-provider';
import { ToolResult } from '../../src/types';

// Mock tool for testing
class CalculatorTool extends BaseTool {
  public readonly name = 'calculator';
  public readonly description = 'Performs basic math calculations';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', description: 'add, subtract, multiply, divide' },
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['operation', 'a', 'b'],
      },
    };
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { operation, a, b } = args;
    let result: number;

    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        result = a / b;
        break;
      default:
        return this.error(`Unknown operation: ${operation}`);
    }

    return this.success(`Result: ${result}`);
  }
}

// Mock LLM provider
class MockProvider implements ILLMProvider {
  async generateCompletion(messages: any[], tools?: any[]): Promise<any> {
    // Simple mock: if last message asks for calculation, return tool call
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.content.includes('5 + 3')) {
      return {
        content: null,
        tool_calls: [
          {
            id: 'test-call-1',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: JSON.stringify({ operation: 'add', a: 5, b: 3 }),
            },
          },
        ],
      };
    }

    // Default response
    return {
      content: 'The answer is 8.',
      tool_calls: null,
    };
  }
}

describe('AgentLoop E2E', () => {
  let agentLoop: AgentLoop;
  let provider: MockProvider;
  let registry: ToolRegistry;

  beforeAll(() => {
    provider = new MockProvider();
    registry = ToolRegistry.getInstance();
    
    // Register calculator tool
    const calcTool = new CalculatorTool();
    registry.registerTool(calcTool);

    agentLoop = new AgentLoop(provider, registry);
  });

  afterAll(() => {
    // Clean up
    (registry as any).tools.clear();
  });

  describe('run', () => {
    it('should complete a simple task without tools', async () => {
      const result = await agentLoop.run(
        '123-test',
        'Hello, how are you?',
        []
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should execute tool when needed', async () => {
      const result = await agentLoop.run(
        '124-test',
        'What is 5 + 3?',
        []
      );

      expect(result).toBeDefined();
      expect(result).toContain('8');
    });
  });
});
