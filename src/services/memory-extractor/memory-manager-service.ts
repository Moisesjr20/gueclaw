import { Message } from '../../types';
import { MemoryRepository } from './memory-repository';
import { MemoryExtractor } from './memory-extractor';
import {
  ExtractedMemory,
  ExtractionResult,
  MemoryQuery,
  MemoryStats,
  MemoryType,
  MemoryExtractionConfig,
  DEFAULT_MEMORY_EXTRACTION_CONFIG,
} from './types';

/**
 * Memory Manager Service
 * Coordinates automatic memory extraction and retrieval
 */
export class MemoryManagerService {
  private static instance: MemoryManagerService;
  private repository: MemoryRepository;
  private extractor: MemoryExtractor | null;
  private config: MemoryExtractionConfig;
  private lastExtractionTime: Map<string, number>; // conversationId -> timestamp

  private constructor(config?: Partial<MemoryExtractionConfig>) {
    this.config = { ...DEFAULT_MEMORY_EXTRACTION_CONFIG, ...config };
    this.repository = new MemoryRepository();
    
    // Only initialize extractor if auto-extraction is enabled (requires LLM provider)
    this.extractor = null;
    try {
      if (this.config.autoExtractionEnabled) {
        this.extractor = new MemoryExtractor(this.config);
      }
    } catch (err) {
      console.warn('[MemoryManagerService] Failed to initialize extractor, auto-extraction disabled');
      this.config.autoExtractionEnabled = false;
    }
    
    this.lastExtractionTime = new Map();

    // Schedule periodic cleanup of expired memories
    this.scheduleCleanup();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<MemoryExtractionConfig>): MemoryManagerService {
    if (!MemoryManagerService.instance) {
      MemoryManagerService.instance = new MemoryManagerService(config);
    }
    return MemoryManagerService.instance;
  }

  /**
   * Extract memories from messages if conditions are met
   */
  public async extractIfNeeded(
    messages: Message[],
    userId: string,
    conversationId: string
  ): Promise<ExtractionResult | null> {
    // Check if auto-extraction is enabled and extractor is available
    if (!this.config.autoExtractionEnabled || !this.extractor) {
      return null;
    }

    // Check minimum message count
    if (messages.length < this.config.minMessagesForExtraction) {
      return null;
    }

    // Check if extraction was recent (avoid too frequent extractions)
    const lastExtraction = this.lastExtractionTime.get(conversationId);
    const now = Date.now();
    const timeSinceLastExtraction = lastExtraction ? now - lastExtraction : Infinity;
    const minTimeBetweenExtractions = 5 * 60 * 1000; // 5 minutes

    if (timeSinceLastExtraction < minTimeBetweenExtractions) {
      return null;
    }

    console.log(`💭 Memory extraction triggered for conversation ${conversationId.substring(0, 8)}...`);

    try {
      const startTime = Date.now();

      // Get messages to process (last N messages)
      const messagesToProcess = messages.slice(-this.config.maxMessagesPerBatch);

      // Extract memories using LLM
      const extractedMemories = await this.extractor.extractFromMessages(
        messagesToProcess,
        userId,
        conversationId
      );

      // Store memories in database
      const storedMemories: ExtractedMemory[] = [];
      for (const memory of extractedMemories) {
        try {
          const stored = this.repository.add(memory);
          storedMemories.push(stored);
        } catch (err) {
          console.error('[MemoryManagerService] Failed to store memory:', err);
        }
      }

      const endTime = Date.now();
      this.lastExtractionTime.set(conversationId, endTime);

      const result: ExtractionResult = {
        memories: storedMemories,
        processedMessageCount: messagesToProcess.length,
        extractionDurationMs: endTime - startTime,
        timestamp: endTime,
      };

      if (storedMemories.length > 0) {
        console.log(`  ✅ Extracted ${storedMemories.length} memories (${result.extractionDurationMs}ms)`);
      } else {
        console.log(`  ℹ️  No significant memories extracted`);
      }

      return result;
    } catch (err) {
      console.error('[MemoryManagerService] Memory extraction failed:', err);
      return null;
    }
  }

  /**
   * Get memories for a user
   */
  public getMemories(query: MemoryQuery): ExtractedMemory[] {
    return this.repository.query(query);
  }

  /**
   * Get all memories for a user
   */
  public getUserMemories(userId: string, limit?: number): ExtractedMemory[] {
    return this.repository.getByUser(userId, limit);
  }

  /**
   * Get memories by type
   */
  public getMemoriesByType(userId: string, type: MemoryType, limit?: number): ExtractedMemory[] {
    return this.repository.getByType(userId, type, limit);
  }

  /**
   * Search memories by tags
   */
  public searchMemories(userId: string, tags: string[]): ExtractedMemory[] {
    return this.repository.searchByTags(userId, tags);
  }

  /**
   * Get memory statistics for a user
   */
  public getStats(userId: string): MemoryStats {
    return this.repository.getStats(userId);
  }

  /**
   * Delete a memory by ID
   */
  public deleteMemory(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Delete all memories for a conversation
   */
  public deleteConversationMemories(conversationId: string): void {
    this.repository.deleteByConversation(conversationId);
  }

  /**
   * Delete all memories for a user
   */
  public deleteUserMemories(userId: string): void {
    this.repository.deleteByUser(userId);
  }

  /**
   * Get memory context enrichment for conversation
   * Returns relevant memories formatted for injection into LLM context
   */
  public getContextEnrichment(userId: string, limit: number = 10): string {
    const memories = this.repository.getByUser(userId, limit);

    if (memories.length === 0) {
      return '';
    }

    // Group by type
    const grouped: Record<string, ExtractedMemory[]> = {};
    memories.forEach((m) => {
      if (!grouped[m.type]) {
        grouped[m.type] = [];
      }
      grouped[m.type].push(m);
    });

    // Build context string
    const lines: string[] = ['## 💭 Contexto Memorizado'];

    Object.entries(grouped).forEach(([type, mems]) => {
      const typeLabel = this.getTypeLabel(type as MemoryType);
      lines.push(`\n**${typeLabel}:**`);
      mems.forEach((m) => {
        const confidence = Math.round(m.confidence * 100);
        lines.push(`- ${m.content} (confiança: ${confidence}%)`);
        if (m.context) {
          lines.push(`  _${m.context}_`);
        }
      });
    });

    return lines.join('\n');
  }

  /**
   * Get human-readable type label
   */
  private getTypeLabel(type: MemoryType): string {
    const labels: Record<MemoryType, string> = {
      preference: 'Preferências',
      decision: 'Decisões',
      fact: 'Fatos',
      goal: 'Objetivos',
      skill: 'Habilidades',
      constraint: 'Restrições',
      context: 'Contexto',
    };
    return labels[type] || type;
  }

  /**
   * Schedule periodic cleanup of expired memories
   */
  private scheduleCleanup(): void {
    // Run cleanup every 24 hours
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

    setInterval(() => {
      try {
        const deletedCount = this.repository.deleteExpired();
        if (deletedCount > 0) {
          console.log(`🧹 Cleaned up ${deletedCount} expired memories`);
        }
      } catch (err) {
        console.error('[MemoryManagerService] Cleanup failed:', err);
      }
    }, CLEANUP_INTERVAL);

    // Also run on startup
    setTimeout(() => {
      const deletedCount = this.repository.deleteExpired();
      if (deletedCount > 0) {
        console.log(`🧹 Startup cleanup: ${deletedCount} expired memories deleted`);
      }
    }, 5000); // 5 seconds after startup
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MemoryExtractionConfig>): void {
    this.config = { ...this.config, ...config };
    this.extractor = new MemoryExtractor(this.config);
  }
}
