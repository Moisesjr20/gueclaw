import { MemoryManager } from '../../src/core/memory/memory-manager';
import { DatabaseConnection } from '../../src/core/memory/database';

// better-sqlite3 is mapped to __mocks__/better-sqlite3.js via jest.config.js
// moduleNameMapper so tests run on any platform without native compilation.

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeAll(() => {
    // Initialize database connection for tests
    DatabaseConnection.getInstance();
    memoryManager = new MemoryManager();
  });

  afterAll(() => {
    DatabaseConnection.getInstance().close();
  });

  describe('addUserMessage', () => {
    it('should add a user message to database', () => {
      const result = memoryManager.addUserMessage(
        'test-conversation-1',
        'Hello, this is a test message'
      );

      expect(result).toBeDefined();
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello, this is a test message');
    });

    it('should add messages with metadata', () => {
      const result = memoryManager.addUserMessage(
        'test-conversation-2',
        'Message with metadata',
        { source: 'telegram', userId: '123' }
      );

      expect(result).toBeDefined();
      expect(result.role).toBe('user');
      expect(result.metadata).toBeDefined();
    });
  });

  describe('addAssistantMessage', () => {
    it('should add assistant messages', () => {
      const result = memoryManager.addAssistantMessage(
        'test-conversation-3',
        'This is an assistant response'
      );

      expect(result).toBeDefined();
      expect(result.role).toBe('assistant');
    });
  });

  describe('getRecentMessages', () => {
    it('should retrieve recent messages', () => {
      const conversationId = 'test-conversation-4';
      
      // Add multiple messages
      memoryManager.addUserMessage(conversationId, 'Message 1');
      memoryManager.addAssistantMessage(conversationId, 'Response 1');
      memoryManager.addUserMessage(conversationId, 'Message 2');

      const messages = memoryManager.getRecentMessages(conversationId);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some(m => m.content === 'Message 1')).toBe(true);
      expect(messages.some(m => m.content === 'Response 1')).toBe(true);
    });
  });

  describe('getAllMessages', () => {
    it('should retrieve all messages for a conversation', () => {
      const conversationId = 'test-conversation-5';
      
      memoryManager.addUserMessage(conversationId, 'First message');
      memoryManager.addAssistantMessage(conversationId, 'First response');

      const messages = memoryManager.getAllMessages(conversationId);

      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('clearConversation', () => {
    it('should clear messages from a conversation', () => {
      const conversationId = 'test-conversation-6';
      
      memoryManager.addUserMessage(conversationId, 'Test message');
      memoryManager.clearConversation(conversationId);

      const messages = memoryManager.getRecentMessages(conversationId);
      expect(messages.length).toBe(0);
    });
  });

  // ── v2.2 additions ─────────────────────────────────────────────────────────

  describe('countMessages', () => {
    it('returns 0 for a conversation with no messages', () => {
      const count = memoryManager.countMessages('empty-conv-xyz');
      expect(count).toBe(0);
    });

    it('returns the correct total number of messages', () => {
      const conversationId = 'count-conv-1';
      memoryManager.addUserMessage(conversationId, 'msg 1');
      memoryManager.addAssistantMessage(conversationId, 'reply 1');
      memoryManager.addUserMessage(conversationId, 'msg 2');

      expect(memoryManager.countMessages(conversationId)).toBe(3);
    });
  });

  describe('getOldMessages', () => {
    it('returns empty array when total messages <= memory window size', () => {
      const conversationId = 'old-msgs-small-conv';
      memoryManager.addUserMessage(conversationId, 'only message');

      const old = memoryManager.getOldMessages(conversationId);
      expect(old).toEqual([]);
    });

    it('returns messages beyond the active window when conversation is long', () => {
      const conversationId = 'old-msgs-long-conv';
      // MEMORY_WINDOW_SIZE defaults to 10; add 12 messages
      for (let i = 1; i <= 12; i++) {
        memoryManager.addUserMessage(conversationId, `message ${i}`);
      }

      const old = memoryManager.getOldMessages(conversationId);
      // Should return the 2 messages that exceed the window
      expect(old.length).toBe(2);
      expect(old[0].content).toBe('message 1');
      expect(old[1].content).toBe('message 2');
    });
  });

  describe('deleteMessages', () => {
    it('deletes messages by their IDs', () => {
      const conversationId = 'delete-msgs-conv';
      const m1 = memoryManager.addUserMessage(conversationId, 'to delete');
      const m2 = memoryManager.addUserMessage(conversationId, 'to keep');

      memoryManager.deleteMessages([m1.id!]);

      const messages = memoryManager.getAllMessages(conversationId);
      expect(messages.some(m => m.id === m1.id)).toBe(false);
      expect(messages.some(m => m.id === m2.id)).toBe(true);
    });

    it('is a no-op when given an empty array', () => {
      const conversationId = 'delete-empty-conv';
      memoryManager.addUserMessage(conversationId, 'safe message');

      expect(() => memoryManager.deleteMessages([])).not.toThrow();
      expect(memoryManager.getAllMessages(conversationId)).toHaveLength(1);
    });
  });

  describe('addCompactSummary', () => {
    it('adds a system message with the compact summary prefix', () => {
      const conversationId = 'compact-summary-conv';
      const msg = memoryManager.addCompactSummary(conversationId, 'resumo do passado');

      expect(msg.role).toBe('system');
      expect(msg.content).toContain('[Resumo de contexto anterior]');
      expect(msg.content).toContain('resumo do passado');
    });

    it('compact summary is retrievable via getAllMessages', () => {
      const conversationId = 'compact-summary-persist-conv';
      memoryManager.addCompactSummary(conversationId, 'contexto compactado');

      const messages = memoryManager.getAllMessages(conversationId);
      const summary = messages.find(m => m.role === 'system' && m.content.includes('contexto compactado'));
      expect(summary).toBeDefined();
    });
  });
});
