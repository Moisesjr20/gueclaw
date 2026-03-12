import { MemoryManager } from '../../src/core/memory/memory-manager';
import { DatabaseConnection } from '../../src/core/memory/database';

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
});
