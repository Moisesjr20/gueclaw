/**
 * Types for Memory Extraction Service
 * Automatically extracts and stores important context from conversations
 */

/**
 * Types of extractable memories
 */
export type MemoryType =
  | 'preference'      // User preferences (e.g., "prefers Python over JavaScript")
  | 'decision'        // Important decisions made (e.g., "decided to use PostgreSQL")
  | 'fact'            // Factual information about user/project (e.g., "works at Company X")
  | 'goal'            // User goals and objectives (e.g., "wants to launch product by Q2")
  | 'skill'           // User skills and expertise (e.g., "experienced in React")
  | 'constraint'      // Project constraints (e.g., "budget limit: $10K")
  | 'context';        // General context (e.g., "building e-commerce platform")

/**
 * Importance level of a memory
 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

/**
 * Extracted memory entity
 */
export interface ExtractedMemory {
  id?: string;                          // Unique identifier
  conversationId: string;               // Source conversation
  userId: string;                       // User who owns this memory
  type: MemoryType;                     // Type of memory
  content: string;                      // Memory content (concise)
  context?: string;                     // Additional context
  importance: MemoryImportance;         // How important this memory is
  confidence: number;                   // Confidence score (0-1)
  sourceMessageIds: string[];           // IDs of messages this was extracted from
  tags: string[];                       // Searchable tags
  extractedAt: number;                  // Timestamp of extraction
  expiresAt?: number;                   // Optional expiration timestamp
  metadata?: Record<string, any>;       // Additional metadata
}

/**
 * Memory extraction result
 */
export interface ExtractionResult {
  memories: ExtractedMemory[];
  processedMessageCount: number;
  extractionDurationMs: number;
  timestamp: number;
}

/**
 * Memory query filters
 */
export interface MemoryQuery {
  userId?: string;
  conversationId?: string;
  types?: MemoryType[];
  importance?: MemoryImportance[];
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  includeExpired?: boolean;
}

/**
 * Configuration for memory extraction
 */
export interface MemoryExtractionConfig {
  /**
   * Minimum number of messages before triggering extraction
   * @default 10
   */
  minMessagesForExtraction: number;

  /**
   * Maximum messages to process in a single extraction batch
   * @default 20
   */
  maxMessagesPerBatch: number;

  /**
   * Minimum confidence score to store a memory (0-1)
   * @default 0.7
   */
  minConfidence: number;

  /**
   * Whether to extract from old messages (already processed)
   * @default false
   */
  reprocessOldMessages: boolean;

  /**
   * Days until low-importance memories expire
   * @default 30
   */
  lowImportanceExpiryDays: number;

  /**
   * Days until medium-importance memories expire
   * @default 90
   */
  mediumImportanceExpiryDays: number;

  /**
   * Maximum tokens for extraction LLM call
   * @default 1000
   */
  extractionMaxTokens: number;

  /**
   * Temperature for extraction (lower = more factual)
   * @default 0.2
   */
  extractionTemperature: number;

  /**
   * Whether automatic extraction is enabled
   * @default true
   */
  autoExtractionEnabled: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_EXTRACTION_CONFIG: MemoryExtractionConfig = {
  minMessagesForExtraction: 10,
  maxMessagesPerBatch: 20,
  minConfidence: 0.7,
  reprocessOldMessages: false,
  lowImportanceExpiryDays: 30,
  mediumImportanceExpiryDays: 90,
  extractionMaxTokens: 1000,
  extractionTemperature: 0.2,
  autoExtractionEnabled: true,
};

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  byImportance: Record<MemoryImportance, number>;
  avgConfidence: number;
  mostRecentExtraction?: number;
}
