import { Message } from '../../types';

/**
 * Configuration for context compression
 */
export interface CompressionConfig {
  /**
   * Maximum number of total messages before triggering compression
   * @default 30
   */
  maxMessages: number;

  /**
   * Number of recent messages to always keep uncompressed
   * Preserves immediate context for coherent conversations
   * @default 10
   */
  recentMessagesWindow: number;

  /**
   * Number of oldest messages to keep for context grounding
   * Useful to preserve initial conversation setup
   * @default 2
   */
  initialMessagesKeep: number;

  /**
   * Maximum tokens for the summary LLM call
   * @default 800
   */
  summaryMaxTokens: number;

  /**
   * Temperature for summary generation (lower = more focused)
   * @default 0.3
   */
  summaryTemperature: number;

  /**
   * Compression strategy to use
   * @default 'sliding-window'
   */
  strategy: CompressionStrategy;

  /**
   * Whether to preserve system messages (never compress)
   * @default true
   */
  preserveSystemMessages: boolean;

  /**
   * Whether to preserve tool calls and responses
   * @default true
   */
  preserveToolCalls: boolean;
}

/**
 * Compression strategies
 */
export type CompressionStrategy = 
  | 'sliding-window'    // Keep recent N messages, summarize oldest
  | 'aggressive'        // Summarize all but recent N messages
  | 'preserve-first'    // Keep first N + recent N, summarize middle
  | 'none';             // No compression (disabled)

/**
 * Result of compression operation
 */
export interface CompressionResult {
  /**
   * Whether compression was performed
   */
  compressed: boolean;

  /**
   * Original message count before compression
   */
  originalCount: number;

  /**
   * Message count after compression
   */
  newCount: number;

  /**
   * Number of messages that were compressed into summary
   */
  messagesCompressed: number;

  /**
   * Estimated tokens saved (approximate)
   */
  tokensSaved: number;

  /**
   * Summary content (if compression occurred)
   */
  summary?: string;

  /**
   * Compression strategy used
   */
  strategy: CompressionStrategy;

  /**
   * Timestamp of compression
   */
  timestamp: number;
}

/**
 * Message classification for compression logic
 */
export interface MessageClassification {
  /**
   * Messages that should never be compressed
   */
  preserve: Message[];

  /**
   * Recent messages to keep in sliding window
   */
  recent: Message[];

  /**
   * Old messages eligible for compression
   */
  compressible: Message[];

  /**
   * Initial messages to optionally keep
   */
  initial: Message[];
}

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxMessages: 30,
  recentMessagesWindow: 10,
  initialMessagesKeep: 2,
  summaryMaxTokens: 800,
  summaryTemperature: 0.3,
  strategy: 'sliding-window',
  preserveSystemMessages: true,
  preserveToolCalls: true,
};
