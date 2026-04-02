import { ContextCompressor } from '../../src/services/context-compressor/context-compressor';
import { MessageClassifier } from '../../src/services/context-compressor/message-classifier';
import { MessageSummarizer } from '../../src/services/context-compressor/message-summarizer';
import { Message, LLMResponse } from '../../src/types';
import { ILLMProvider } from '../../src/core/providers/base-provider';

// Mock LLM Provider
class MockLLMProvider implements ILLMProvider {
  readonly name = 'mock-provider';
  readonly supportsToolCalls = false;
  readonly supportsStreaming = false;

  async generateCompletion(messages: Message[], options?: any): Promise<LLMResponse> {
    return {
      content: 'This is a test summary of the conversation. Key points: user asked questions, assistant provided answers.',
      finishReason: 'stop',
    };
  }
}

// Helper to create test messages
function createMessage(role: 'user' | 'assistant' | 'system' | 'tool', content: string, timestamp?: number): Message {
  return {
    id: Math.random().toString(36),
    conversationId: 'test-conv',
    role,
    content,
    timestamp: timestamp || Date.now(),
  };
}

describe('MessageClassifier', () => {
  const config = {
    maxMessages: 30,
    recentMessagesWindow: 5,
    initialMessagesKeep: 2,
    summaryMaxTokens: 800,
    summaryTemperature: 0.3,
    strategy: 'sliding-window' as const,
    preserveSystemMessages: true,
    preserveToolCalls: true,
  };

  const classifier = new MessageClassifier(config);

  test('should classify messages into categories', () => {
    const messages: Message[] = [
      createMessage('system', 'System message', 1000),
      createMessage('user', 'First user message', 2000),
      createMessage('assistant', 'First assistant response', 3000),
      createMessage('user', 'Second user message', 4000),
      createMessage('assistant', 'Second assistant response', 5000),
      createMessage('user', 'Third user message', 6000),
      createMessage('assistant', 'Third assistant response', 7000),
      createMessage('user', 'Recent message 1', 8000),
      createMessage('assistant', 'Recent response 1', 9000),
      createMessage('user', 'Recent message 2', 10000),
      createMessage('assistant', 'Recent response 2', 11000),
      createMessage('user', 'Most recent message', 12000),
    ];

    const classification = classifier.classify(messages);

    // System message should be preserved
    expect(classification.preserve.length).toBeGreaterThan(0);
    expect(classification.preserve.some(m => m.role === 'system')).toBe(true);

    // Recent messages (last 5)
    expect(classification.recent.length).toBeLessThanOrEqual(5);

    // Initial messages (first 2 non-system)
    expect(classification.initial.length).toBeLessThanOrEqual(2);

    // Everything else should be compressible
    expect(classification.compressible.length).toBeGreaterThan(0);
  });

  test('should preserve tool calls and responses', () => {
    const messages: Message[] = [
      createMessage('user', 'User message', 1000),
      { 
        id: '1',
        conversationId: 'test',
        role: 'assistant' as const,
        content: '',
        timestamp: 2000,
        toolCalls: [{ 
          id: 'call_123',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: {},
          }
        }],
      },
      createMessage('tool', 'Tool result', 3000),
      createMessage('user', 'Another user message', 4000),
    ];

    const classification = classifier.classify(messages);

    // Tool calls and responses should be preserved
    const preserved = classification.preserve;
    expect(preserved.some(m => m.toolCalls !== undefined)).toBe(true);
    expect(preserved.some(m => m.role === 'tool')).toBe(true);
  });

  test('should estimate tokens correctly', () => {
    const messages: Message[] = [
      createMessage('user', 'Short message', 1000),
      createMessage('assistant', 'A'.repeat(350), 2000), // ~100 tokens
    ];

    const tokens = classifier.estimateTokens(messages);
    
    // Should estimate ~100+ tokens (1 token ≈ 3.5 chars)
    expect(tokens).toBeGreaterThan(50);
    expect(tokens).toBeLessThan(200);
  });
});

describe('MessageSummarizer', () => {
  const config = {
    maxMessages: 30,
    recentMessagesWindow: 10,
    initialMessagesKeep: 2,
    summaryMaxTokens: 800,
    summaryTemperature: 0.3,
    strategy: 'sliding-window' as const,
    preserveSystemMessages: true,
    preserveToolCalls: true,
  };

  const mockProvider = new MockLLMProvider();
  const summarizer = new MessageSummarizer(config, mockProvider);

  test('should generate summary from messages', async () => {
    const messages: Message[] = [
      createMessage('user', 'What is the weather?', 1000),
      createMessage('assistant', 'The weather is sunny.', 2000),
      createMessage('user', 'Tell me a joke', 3000),
      createMessage('assistant', 'Why did the chicken cross the road?', 4000),
    ];

    const summary = await summarizer.summarize(messages);
    
    expect(summary).toBeDefined();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('summary');
  });

  test('should create summary message correctly', () => {
    const summary = 'This is a test summary';
    const summaryMsg = summarizer.createSummaryMessage('test-conv', summary, 10);

    expect(summaryMsg.role).toBe('system');
    expect(summaryMsg.conversationId).toBe('test-conv');
    expect(summaryMsg.content).toContain(summary);
    expect(summaryMsg.content).toContain('10');
  });

  test('should handle very long messages in transcript', async () => {
    const longContent = 'A'.repeat(2000);
    const messages: Message[] = [
      createMessage('user', longContent, 1000),
    ];

    const summary = await summarizer.summarize(messages);
    
    // Should not fail even with long messages
    expect(summary).toBeDefined();
  });
});

describe('ContextCompressor', () => {
  const mockProvider = new MockLLMProvider();
  
  test('should not compress when below threshold', async () => {
    const compressor = new ContextCompressor({ maxMessages: 30 }, mockProvider);
    
    const messages: Message[] = [
      createMessage('user', 'Message 1', 1000),
      createMessage('assistant', 'Response 1', 2000),
    ];

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    expect(stats.compressed).toBe(false);
    expect(result.length).toBe(messages.length);
  });

  test('should compress when above threshold', async () => {
    const compressor = new ContextCompressor(
      { 
        maxMessages: 10,
        recentMessagesWindow: 3,
        initialMessagesKeep: 1,
        strategy: 'sliding-window',
      },
      mockProvider
    );
    
    // Create 15 messages (above threshold of 10)
    const messages: Message[] = [];
    for (let i = 0; i < 15; i++) {
      messages.push(createMessage('user', `Message ${i}`, 1000 + i * 1000));
      messages.push(createMessage('assistant', `Response ${i}`, 1500 + i * 1000));
    }

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    expect(stats.compressed).toBe(true);
    expect(result.length).toBeLessThan(messages.length);
    expect(stats.tokensSaved).toBeGreaterThan(0);
    expect(stats.summary).toBeDefined();
  });

  test('should preserve system messages during compression', async () => {
    const compressor = new ContextCompressor(
      { 
        maxMessages: 5,
        recentMessagesWindow: 2,
        strategy: 'sliding-window',
      },
      mockProvider
    );
    
    const messages: Message[] = [
      createMessage('system', 'Important system message', 1000),
      createMessage('user', 'Message 1', 2000),
      createMessage('assistant', 'Response 1', 3000),
      createMessage('user', 'Message 2', 4000),
      createMessage('assistant', 'Response 2', 5000),
      createMessage('user', 'Message 3', 6000),
      createMessage('assistant', 'Response 3', 7000),
      createMessage('user', 'Recent message', 8000),
    ];

    const { messages: result } = await compressor.compressIfNeeded(messages);
    
    // System message should still be present
    expect(result.some(m => m.role === 'system' && m.content.includes('Important'))).toBe(true);
  });

  test('should use sliding-window strategy correctly', async () => {
    const compressor = new ContextCompressor(
      { 
        maxMessages: 8,
        recentMessagesWindow: 3,
        initialMessagesKeep: 1,
        strategy: 'sliding-window',
      },
      mockProvider
    );
    
    const messages: Message[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push(createMessage('user', `Message ${i}`, 1000 + i * 1000));
    }

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    expect(stats.compressed).toBe(true);
    expect(result.length).toBeLessThan(messages.length);
    
    // Check that recent messages are preserved
    const recentContent = result.filter(m => m.content.includes('Message 11') || m.content.includes('Message 10'));
    expect(recentContent.length).toBeGreaterThan(0);
  });

  test('should use aggressive strategy correctly', async () => {
    const compressor = new ContextCompressor(
      { 
        maxMessages: 8,
        recentMessagesWindow: 3,
        strategy: 'aggressive',
      },
      mockProvider
    );
    
    const messages: Message[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push(createMessage('user', `Message ${i}`, 1000 + i * 1000));
    }

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    expect(stats.compressed).toBe(true);
    // Aggressive should compress more aggressively
    expect(result.length).toBeLessThanOrEqual(5); // summary + recent
  });

  test('should handle compression errors gracefully', async () => {
    // Provider that throws error
    const errorProvider: ILLMProvider = {
      name: 'error-provider',
      supportsToolCalls: false,
      supportsStreaming: false,
      async generateCompletion() {
        throw new Error('LLM error');
      },
    };

    const compressor = new ContextCompressor(
      { maxMessages: 5, recentMessagesWindow: 2 },
      errorProvider
    );
    
    const messages: Message[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push(createMessage('user', `Message ${i}`, 1000 + i * 1000));
    }

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    // Should use fallback summary when LLM fails
    // Compression still happens with fallback (compressed=true)
    // But messages are reduced (less than original)
    expect(stats.compressed).toBe(true);
    expect(result.length).toBeLessThan(messages.length);
    expect(stats.summary).toBeDefined(); // Fallback summary exists
  });

  test('should update configuration correctly', () => {
    const compressor = new ContextCompressor({ maxMessages: 30 }, mockProvider);
    
    const originalConfig = compressor.getConfig();
    expect(originalConfig.maxMessages).toBe(30);

    compressor.updateConfig({ maxMessages: 50, recentMessagesWindow: 15 });
    
    const newConfig = compressor.getConfig();
    expect(newConfig.maxMessages).toBe(50);
    expect(newConfig.recentMessagesWindow).toBe(15);
  });

  test('should disable compression when strategy is "none"', async () => {
    const compressor = new ContextCompressor(
      { maxMessages: 5, strategy: 'none' },
      mockProvider
    );
    
    const messages: Message[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push(createMessage('user', `Message ${i}`, 1000 + i * 1000));
    }

    const { messages: result, result: stats } = await compressor.compressIfNeeded(messages);
    
    expect(stats.compressed).toBe(false);
    expect(result.length).toBe(messages.length);
  });
});
