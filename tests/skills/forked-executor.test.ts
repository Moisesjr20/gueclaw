import { ForkedExecutor } from '../../src/core/skills/forked-executor';
import { AgentLoop } from '../../src/core/agent-loop';
import { ILLMProvider } from '../../src/llm-providers/types';
import { Message } from '../../src/types/message';

// Mock AgentLoop
jest.mock('../../src/core/agent-loop');

describe('ForkedExecutor', () => {
  let mockProvider: ILLMProvider;
  let mockConversationHistory: Message[];

  beforeEach(() => {
    jest.clearAllMocks();

    mockProvider = {
      name: 'mock-provider',
      chat: jest.fn().mockResolvedValue('Mock response'),
      chatWithSchema: jest.fn(),
    } as unknown as ILLMProvider;

    mockConversationHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
  });

  describe('execute', () => {
    it('should execute skill in isolated context', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Skill execution result'),
        conversationHistory: [...mockConversationHistory],
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Execute this task',
        mockConversationHistory,
        mockProvider,
        'System prompt for skill'
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('Skill execution result');
      expect(result.messages).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should clone conversation history without mutating original', async () => {
      const originalHistory = [...mockConversationHistory];
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: [
          ...mockConversationHistory,
          { role: 'user', content: 'New message in forked context' },
        ],
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt'
      );

      // Original history should remain unchanged
      expect(mockConversationHistory).toEqual(originalHistory);
      expect(mockConversationHistory.length).toBe(2);
    });

    it('should respect maxIterations option', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt',
        { maxIterations: 5 }
      );

      // Verify AgentLoop was instantiated with correct iterations
      expect(AgentLoop).toHaveBeenCalledWith(
        mockProvider,
        expect.any(Array),
        'System prompt',
        expect.any(Object),
        undefined,
        undefined,
        5 // maxIterations
      );
    });

    it('should handle timeout correctly', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('Should not complete'), 5000);
          });
        }),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Long running task',
        mockConversationHistory,
        mockProvider,
        'System prompt',
        { timeout: 100 } // 100ms timeout
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.duration).toBeGreaterThanOrEqual(100);
    });

    it('should handle execution errors gracefully', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockRejectedValue(new Error('Skill execution failed')),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Task that fails',
        mockConversationHistory,
        mockProvider,
        'System prompt'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Skill execution failed');
      expect(result.output).toBe('');
    });

    it('should calculate tokens used from conversation history', async () => {
      const longConversation: Message[] = [
        { role: 'user', content: 'First message with some content ' },
        { role: 'assistant', content: 'Response with even more content here' },
        { role: 'user', content: 'Another user message' },
        { role: 'assistant', content: 'A'.repeat(1000) }, // Long response
      ];

      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: longConversation,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt'
      );

      expect(result.tokensUsed).toBeGreaterThan(200); // ~1000 chars = ~250 tokens
    });

    it('should include extra context if provided', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const extraContext = { currentTask: 'test', userId: '12345' };

      await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt',
        { extraContext }
      );

      // Verify AgentLoop was called with extra context
      expect(AgentLoop).toHaveBeenCalledWith(
        mockProvider,
        expect.any(Array),
        'System prompt',
        extraContext,
        undefined,
        undefined,
        undefined
      );
    });

    it('should handle empty conversation history', async () => {
      const emptyHistory: Message[] = [];
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: emptyHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'First message',
        emptyHistory,
        mockProvider,
        'System prompt'
      );

      expect(result.success).toBe(true);
      expect(result.messages).toEqual([]);
      expect(result.tokensUsed).toBeGreaterThan(0); // At least input/output tokens
    });

    it('should track execution duration accurately', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('Delayed result'), 50);
          });
        }),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt'
      );

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(50);
      expect(result.duration).toBeLessThan(200); // Should complete quickly
    });
  });

  describe('getExecutionStats', () => {
    it('should format successful execution stats', () => {
      const result = {
        success: true,
        output: 'Task completed',
        messages: mockConversationHistory,
        tokensUsed: 150,
        duration: 1250,
      };

      const stats = ForkedExecutor.getExecutionStats(result);

      expect(stats).toContain('1.25s');
      expect(stats).toContain('150 tokens');
      expect(stats).toContain('2 messages');
    });

    it('should format failed execution stats with error', () => {
      const result = {
        success: false,
        output: '',
        error: 'API timeout',
        messages: [],
        tokensUsed: 50,
        duration: 5000,
      };

      const stats = ForkedExecutor.getExecutionStats(result);

      expect(stats).toContain('5.00s');
      expect(stats).toContain('50 tokens');
      expect(stats).toContain('FAILED');
      expect(stats).toContain('API timeout');
    });

    it('should handle zero duration', () => {
      const result = {
        success: true,
        output: 'Fast execution',
        messages: [],
        tokensUsed: 10,
        duration: 0,
      };

      const stats = ForkedExecutor.getExecutionStats(result);

      expect(stats).toContain('0.00s');
      expect(stats).toContain('10 tokens');
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxTokens limit (passed to agent loop)', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt',
        { maxTokens: 500 }
      );

      // maxTokens is not directly used by AgentLoop, but should be accepted
      expect(AgentLoop).toHaveBeenCalled();
    });

    it('should handle conversationId for tracking', async () => {
      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Result'),
        conversationHistory: mockConversationHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt',
        { conversationId: 'conv-12345' }
      );

      expect(AgentLoop).toHaveBeenCalledWith(
        mockProvider,
        expect.any(Array),
        'System prompt',
        expect.any(Object),
        undefined,
        'conv-12345',
        undefined
      );
    });

    it('should extract output from complex conversation history', async () => {
      const complexHistory: Message[] = [
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Question 2' },
        { role: 'assistant', content: 'Answer 2 with more detail' },
        { role: 'user', content: 'Final question' },
        { role: 'assistant', content: 'Final answer that should be extracted' },
      ];

      const mockAgentLoop = {
        run: jest.fn().mockResolvedValue('Direct return value'),
        conversationHistory: complexHistory,
      };
      (AgentLoop as jest.Mock).mockImplementation(() => mockAgentLoop);

      const result = await ForkedExecutor.execute(
        'test-skill',
        'Task',
        mockConversationHistory,
        mockProvider,
        'System prompt'
      );

      // Should use agent loop return value, not extract from history
      expect(result.output).toBe('Direct return value');
    });
  });
});
