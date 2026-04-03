import { MemoryRepository } from '../../src/services/memory-extractor/memory-repository';
import { MemoryExtractor } from '../../src/services/memory-extractor/memory-extractor';
import { MemoryManagerService } from '../../src/services/memory-extractor/memory-manager-service';
import { Message, LLMResponse } from '../../src/types';
import { ILLMProvider } from '../../src/core/providers/base-provider';
import { ExtractedMemory, MemoryType } from '../../src/services/memory-extractor/types';
import { DatabaseConnection } from '../../src/core/memory/database';

// Mock LLM Provider for memory extraction
class MockMemoryProvider implements ILLMProvider {
  readonly name = 'mock-memory-provider';
  readonly supportsToolCalls = false;
  readonly supportsStreaming = false;

  async generateCompletion(messages: Message[], options?: any): Promise<LLMResponse> {
    // Simulate LLM returning extracted memories in JSON format
    const mockResponse = `\`\`\`json
[
  {
    "type": "preference",
    "content": "Prefere TypeScript a JavaScript",
    "context": "Mencionado ao discutir linguagens de programação",
    "importance": "medium",
    "confidence": 0.9,
    "tags": ["typescript", "javascript", "linguagem"]
  },
  {
    "type": "goal",
    "content": "Quer lançar MVP em 2 meses",
    "context": "Prazo definido para projeto atual",
    "importance": "high",
    "confidence": 0.95,
    "tags": ["mvp", "prazo", "objetivo"]
  }
]
\`\`\``;

    return {
      content: mockResponse,
      finishReason: 'stop',
    };
  }
}

// Helper to create test messages
function createMessage(role: 'user' | 'assistant', content: string, id?: string): Message {
  return {
    id: id || `msg_${Math.random().toString(36).substr(2, 9)}`,
    conversationId: 'test-conv',
    role,
    content,
    timestamp: Date.now(),
  };
}

describe('MemoryRepository', () => {
  let repository: MemoryRepository;
  const testUserId = `test-user-${Date.now()}`;

  beforeEach(() => {
    repository = new MemoryRepository();
  });

  afterEach(() => {
    // Aggressive cleanup: delete ALL memories from test database
    const db = DatabaseConnection.getInstance();
    db.exec('DELETE FROM extracted_memories');
  });

  test('should add and retrieve memory', () => {
    const memory: ExtractedMemory = {
      conversationId: 'test-conv',
      userId: testUserId,
      type: 'preference',
      content: 'Likes Python',
      importance: 'medium',
      confidence: 0.9,
      sourceMessageIds: ['msg1', 'msg2'],
      tags: ['python', 'programming'],
      extractedAt: Date.now(),
    };

    const added = repository.add(memory);

    expect(added.id).toBeDefined();
    expect(added.content).toBe('Likes Python');

    const retrieved = repository.getByUser(testUserId);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].content).toBe('Likes Python');
  });

  test('should filter memories by type', () => {
    const testUserId2 = `test-user-${Date.now()}-${Math.random()}-2`;
    
    repository.add({
      conversationId: 'test-conv',
      userId: testUserId2,
      type: 'preference',
      content: 'Memory 1',
      importance: 'medium',
      confidence: 0.9,
      sourceMessageIds: [],
      tags: [],
      extractedAt: Date.now(),
    });

    repository.add({
      conversationId: 'test-conv',
      userId: testUserId2,
      type: 'goal',
      content: 'Memory 2',
      importance: 'high',
      confidence: 0.95,
      sourceMessageIds: [],
      tags: [],
      extractedAt: Date.now(),
    });

    const preferences = repository.getByType(testUserId2, 'preference');
    const goals = repository.getByType(testUserId2, 'goal');

    expect(preferences).toHaveLength(1);
    expect(goals).toHaveLength(1);
    expect(preferences[0].content).toBe('Memory 1');
    expect(goals[0].content).toBe('Memory 2');
    
    // Cleanup
    repository.deleteByUser(testUserId2);
  });

  test('should delete expired memories', () => {
    const now = Date.now();
    const pastExpiry = now - 1000; // Expired 1 second ago
    const futureExpiry = now + 1000000; // Expires in future
    const testUserId3 = `test-user-${Date.now()}-${Math.random()}-3`;

    repository.add({
      conversationId: 'test-conv',
      userId: testUserId3,
      type: 'preference',
      content: 'Expired memory',
      importance: 'low',
      confidence: 0.8,
      sourceMessageIds: [],
      tags: [],
      extractedAt: now,
      expiresAt: pastExpiry,
    });

    repository.add({
      conversationId: 'test-conv',
      userId: testUserId3,
      type: 'preference',
      content: 'Valid memory',
      importance: 'high',
      confidence: 0.9,
      sourceMessageIds: [],
      tags: [],
      extractedAt: now,
      expiresAt: futureExpiry,
    });

    const deletedCount = repository.deleteExpired();
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    const remaining = repository.getByUser(testUserId3);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe('Valid memory');
    
    // Cleanup
    repository.deleteByUser(testUserId3);
  });

  test('should get memory statistics', () => {
    const testUserId4 = `test-user-${Date.now()}-${Math.random()}-4`;
    
    repository.add({
      conversationId: 'test-conv',
      userId: testUserId4,
      type: 'preference',
      content: 'Pref 1',
      importance: 'medium',
      confidence: 0.9,
      sourceMessageIds: [],
      tags: [],
      extractedAt: Date.now(),
    });

    repository.add({
      conversationId: 'test-conv',
      userId: testUserId4,
      type: 'preference',
      content: 'Pref 2',
      importance: 'high',
      confidence: 0.95,
      sourceMessageIds: [],
      tags: [],
      extractedAt: Date.now(),
    });

    const stats = repository.getStats(testUserId4);

    expect(stats.totalMemories).toBe(2);
    expect(stats.byType['preference']).toBe(2);
    expect(stats.byImportance['medium']).toBe(1);
    expect(stats.byImportance['high']).toBe(1);
    expect(stats.avgConfidence).toBeCloseTo(0.925, 2);
    
    // Cleanup
    repository.deleteByUser(testUserId4);
  });
});

describe('MemoryExtractor', () => {
  let extractor: MemoryExtractor;
  let mockProvider: MockMemoryProvider;

  beforeEach(() => {
    mockProvider = new MockMemoryProvider();
    extractor = new MemoryExtractor({}, mockProvider);
  });

  test('should extract memories from messages', async () => {
    const messages: Message[] = [
      createMessage('user', 'Eu prefiro TypeScript a JavaScript para meus projetos'),
      createMessage('assistant', 'Entendi! TypeScript oferece tipagem estática.'),
      createMessage('user', 'Meu objetivo é lançar o MVP em 2 meses'),
      createMessage('assistant', 'Ok, 2 meses é um prazo agressivo mas factível.'),
    ];

    const memories = await extractor.extractFromMessages(
      messages,
      'test-user',
      'test-conv'
    );

    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].type).toBeDefined();
    expect(memories[0].content).toBeDefined();
    expect(memories[0].confidence).toBeGreaterThanOrEqual(0);
    expect(memories[0].confidence).toBeLessThanOrEqual(1);
  });

  test('should return empty array for empty messages', async () => {
    const memories = await extractor.extractFromMessages([], 'test-user', 'test-conv');
    expect(memories).toEqual([]);
  });
});

describe('MemoryManagerService', () => {
  test('should get memory stats for empty user', () => {
    const service = MemoryManagerService.getInstance({
      autoExtractionEnabled: false, // Disable auto extraction in tests
    });
    
    const testUserId = `test-user-stats-${Date.now()}`;
    const stats = service.getStats(testUserId);
    expect(stats.totalMemories).toBe(0);
    expect(stats.avgConfidence).toBe(0);
  });

  test('should get empty user memories', () => {
    const service = MemoryManagerService.getInstance({
      autoExtractionEnabled: false,
    });
    
    const testUserId = `test-user-empty-${Date.now()}`;
    const memories = service.getUserMemories(testUserId);
    expect(memories).toHaveLength(0);
  });

  test('should get context enrichment for user with no memories', () => {
    const service = MemoryManagerService.getInstance({
      autoExtractionEnabled: false,
    });
    
    const testUserId = `test-user-enrichment-${Date.now()}`;
    const enrichment = service.getContextEnrichment(testUserId, 10);
    expect(enrichment).toBe('');
  });
});
