import { ConversationRepository } from './conversation-repository';
import { MessageRepository } from './message-repository';
import { Message, Conversation } from '../../types';

/**
 * Memory Manager - Facade for conversation and message management
 */
export class MemoryManager {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private memoryWindowSize: number;

  constructor() {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
    this.memoryWindowSize = parseInt(process.env.MEMORY_WINDOW_SIZE || '10', 10);
  }

  /**
   * Get or create a conversation for a user
   */
  public getConversation(userId: string, provider?: string): Conversation {
    return this.conversationRepo.getOrCreate(userId, provider);
  }

  /**
   * Add a user message
   */
  public addUserMessage(conversationId: string, content: string, metadata?: Record<string, any>): Message {
    const message = this.messageRepo.add({
      conversationId,
      role: 'user',
      content,
      metadata,
    });

    this.conversationRepo.touch(conversationId);
    return message;
  }

  /**
   * Add an assistant message
   */
  public addAssistantMessage(conversationId: string, content: string, metadata?: Record<string, any>): Message {
    const message = this.messageRepo.add({
      conversationId,
      role: 'assistant',
      content,
      metadata,
    });

    this.conversationRepo.touch(conversationId);
    return message;
  }

  /**
   * Add a system message
   */
  public addSystemMessage(conversationId: string, content: string): Message {
    return this.messageRepo.add({
      conversationId,
      role: 'system',
      content,
    });
  }

  /**
   * Add a tool result message
   */
  public addToolMessage(conversationId: string, content: string, toolName?: string): Message {
    return this.messageRepo.add({
      conversationId,
      role: 'tool',
      content,
      metadata: { toolName },
    });
  }

  /**
   * Get recent messages with truncation (memory window)
   */
  public getRecentMessages(conversationId: string): Message[] {
    return this.messageRepo.getRecent(conversationId, this.memoryWindowSize);
  }

  /**
   * Get all messages from a conversation
   */
  public getAllMessages(conversationId: string): Message[] {
    return this.messageRepo.getAll(conversationId);
  }

  /**
   * Clear conversation history
   */
  public clearConversation(conversationId: string): void {
    this.messageRepo.deleteByConversation(conversationId);
  }

  /**
   * Cleanup old conversations
   */
  public cleanup(daysOld: number = 30): void {
    const deletedCount = this.conversationRepo.deleteOlderThan(daysOld);
    console.log(`🧹 Cleaned up ${deletedCount} old conversations`);
  }
}
