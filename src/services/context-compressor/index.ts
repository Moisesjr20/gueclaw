/**
 * Context Compression Service
 * 
 * Reduces conversation token usage by intelligently compressing old messages
 * while preserving recent context and important information.
 * 
 * @example
 * ```typescript
 * import { ContextCompressor, DEFAULT_COMPRESSION_CONFIG } from './services/context-compressor';
 * 
 * const compressor = new ContextCompressor({
 *   maxMessages: 30,
 *   recentMessagesWindow: 10,
 *   strategy: 'sliding-window'
 * });
 * 
 * const { messages, result } = await compressor.compressIfNeeded(conversationMessages);
 * 
 * if (result.compressed) {
 *   console.log(`Saved ~${result.tokensSaved} tokens!`);
 * }
 * ```
 */

export { ContextCompressor } from './context-compressor';
export { MessageClassifier } from './message-classifier';
export { MessageSummarizer } from './message-summarizer';

export type {
  CompressionConfig,
  CompressionStrategy,
  CompressionResult,
  MessageClassification,
} from './types';

export { DEFAULT_COMPRESSION_CONFIG } from './types';
