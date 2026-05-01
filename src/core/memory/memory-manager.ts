import { ConversationRepository } from './conversation-repository';
import { MessageRepository } from './message-repository';
import { Message, Conversation } from '../../types';
import { RAGService } from '../../services/rag-service';

/**
 * Memory Manager - Facade for conversation and message management
 */
export class MemoryManager {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private memoryWindowSize: number;
  private ragEnabled: boolean = false;

  constructor() {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
    this.memoryWindowSize = parseInt(process.env.MEMORY_WINDOW_SIZE || '10', 10);
    
    // Check if RAG is enabled (requires GEMINI_API_KEY)
    if (process.env.GEMINI_API_KEY) {
      this.ragEnabled = true;
      console.log('🧠 RAG (Semantic Memory) enabled via pgvector');
    }
  }

  /**
   * Get or create a conversation for a user
   */
  public getConversation(userId: string, provider?: string): Conversation {
    return this.conversationRepo.getOrCreate(userId, provider);
  }

  /**
   * Force-create a new conversation
   */
  public createConversation(userId: string, provider: string = 'dashboard'): Conversation {
    return this.conversationRepo.create(userId, provider);
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
    
    // Asynchronous semantic indexing
    if (this.ragEnabled) {
      const conversation = this.conversationRepo.getById(conversationId);
      if (conversation) {
        RAGService.getInstance().storeMemory(conversation.userId, content, {
          role: 'user',
          conversationId,
          messageId: message.id
        }).catch(err => console.error('❌ RAG Indexing Error:', err));
      }
    }

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

    // Asynchronous semantic indexing
    if (this.ragEnabled) {
      const conversation = this.conversationRepo.getById(conversationId);
      if (conversation) {
        RAGService.getInstance().storeMemory(conversation.userId, content, {
          role: 'assistant',
          conversationId,
          messageId: message.id
        }).catch(err => console.error('❌ RAG Indexing Error:', err));
      }
    }

    return message;
  }

  /**
   * Search relevant memories semantically (RAG)
   */
  public async searchSemanticContext(userId: string, query: string, limit: number = 3): Promise<string> {
    if (!this.ragEnabled) return '';

    const results = await RAGService.getInstance().searchMemories(userId, query, limit);
    if (results.length === 0) return '';

    const context = results
      .map(r => `[Relacionado (${Math.round(r.similarity * 100)}%)]: ${r.content}`)
      .join('\n\n');

    return `\n--- CONTEXTO SEMÂNTICO RECUPERADO ---\n${context}\n--------------------------------------\n`;
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
   * Count total messages in a conversation
   */
  public countMessages(conversationId: string): number {
    return this.messageRepo.count(conversationId);
  }

  /**
   * Get messages beyond the active memory window (compaction candidates)
   */
  public getOldMessages(conversationId: string): Message[] {
    return this.messageRepo.getOldMessages(conversationId, this.memoryWindowSize);
  }

  /**
   * Delete messages by IDs (used after compaction)
   */
  public deleteMessages(messageIds: string[]): void {
    this.messageRepo.deleteByIds(messageIds);
  }

  /**
   * Add a system message that represents a compaction summary
   */
  public addCompactSummary(conversationId: string, summary: string): Message {
    return this.messageRepo.add({
      conversationId,
      role: 'system',
      content: `[Resumo de contexto anterior]\n${summary}`,
      metadata: { type: 'compact_summary' },
    });
  }

  /**
   * Cleanup old conversations
   */
  public cleanup(daysOld: number = 30): void {
    const deletedCount = this.conversationRepo.deleteOlderThan(daysOld);
    console.log(`🧹 Cleaned up ${deletedCount} old conversations`);
  }
}
