import { AgentLoop } from '../../src/core/agent-loop/agent-loop';
import { ILLMProvider, CompletionOptions, ToolDefinition } from '../../src/core/providers/base-provider';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { BaseTool } from '../../src/tools/base-tool';
import { Message, LLMResponse, ToolResult } from '../../src/types';

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
  public readonly name = 'mock-provider';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;

  async generateCompletion(messages: Message[], _options?: CompletionOptions): Promise<LLMResponse> {
    // If a tool result is already in history, return final answer
    const hasToolResult = messages.some(m => m.role === 'tool');
    if (hasToolResult) {
      return { content: 'The answer is 8.', finishReason: 'stop' };
    }

    // If user asks for calculation, return a tool call
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.content && lastMessage.content.includes('5 + 3')) {
      return {
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'test-call-1',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: { operation: 'add', a: 5, b: 3 },
            },
          },
        ],
      };
    }

    // Default response
    return { content: 'The answer is 8.', finishReason: 'stop' };
  }
}

describe('AgentLoop E2E', () => {
  let agentLoop: AgentLoop;
  let provider: MockProvider;

  beforeAll(() => {
    ToolRegistry.clear();
    ToolRegistry.register(new CalculatorTool());
    provider = new MockProvider();
    agentLoop = new AgentLoop(provider, []);
  });

  afterAll(() => {
    ToolRegistry.clear();
  });

  describe('run', () => {
    it('should complete a simple task without tools', async () => {
      const result = await agentLoop.run('Hello, how are you?');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should execute tool when needed', async () => {
      const loop = new AgentLoop(provider, []);
      const result = await loop.run('What is 5 + 3?');

      expect(result).toBeDefined();
      expect(result).toContain('8');
    });
  });
});
