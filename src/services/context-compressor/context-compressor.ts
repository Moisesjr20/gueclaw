import { Message } from '../../types';
import {
  CompressionConfig,
  CompressionResult,
  CompressionStrategy,
  DEFAULT_COMPRESSION_CONFIG,
} from './types';
import { MessageClassifier } from './message-classifier';
import { MessageSummarizer } from './message-summarizer';
import { ILLMProvider } from '../../core/providers/base-provider';

/**
 * Context Compression Service
 * Reduces conversation context size by intelligently summarizing old messages
 */
export class ContextCompressor {
  private config: CompressionConfig;
  private classifier: MessageClassifier;
  private summarizer: MessageSummarizer;
  private provider?: ILLMProvider;

  constructor(
    config?: Partial<CompressionConfig>,
    provider?: ILLMProvider
  ) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
    this.provider = provider;
    this.classifier = new MessageClassifier(this.config);
    this.summarizer = new MessageSummarizer(this.config, provider);
  }

  /**
   * Check if compression is needed
   */
  public needsCompression(messages: Message[]): boolean {
    // No compression if disabled
    if (this.config.strategy === 'none') {
      return false;
    }

    // Check if message count exceeds threshold
    return messages.length > this.config.maxMessages;
  }

  /**
   * Compress messages if needed
   * Returns new compressed message array and compression statistics
   */
  public async compressIfNeeded(messages: Message[]): Promise<{
    messages: Message[];
    result: CompressionResult;
  }> {
    const originalCount = messages.length;

    // Check if compression needed
    if (!this.needsCompression(messages)) {
      return {
        messages,
        result: {
          compressed: false,
          originalCount,
          newCount: originalCount,
          messagesCompressed: 0,
          tokensSaved: 0,
          strategy: this.config.strategy,
          timestamp: Date.now(),
        },
      };
    }

    console.log(`🗜️  Context compression triggered (${originalCount} messages > ${this.config.maxMessages})`);

    try {
      // Perform compression based on strategy
      const compressed = await this.compress(messages);
      return compressed;
    } catch (err) {
      console.error('⚠️  Compression failed (non-critical):', err);
      
      // Return original messages if compression fails
      return {
        messages,
        result: {
          compressed: false,
          originalCount,
          newCount: originalCount,
          messagesCompressed: 0,
          tokensSaved: 0,
          strategy: this.config.strategy,
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * Perform compression using configured strategy
   */
  private async compress(messages: Message[]): Promise<{
    messages: Message[];
    result: CompressionResult;
  }> {
    const strategy = this.config.strategy;

    switch (strategy) {
      case 'sliding-window':
        return this.compressSlidingWindow(messages);
      case 'aggressive':
        return this.compressAggressive(messages);
      case 'preserve-first':
        return this.compressPreserveFirst(messages);
      default:
        throw new Error(`Unknown compression strategy: ${strategy}`);
    }
  }

  /**
   * Sliding window strategy:
   * - Keep recent N messages
   * - Summarize everything else
   * - Preserve system messages and tool calls
   */
  private async compressSlidingWindow(messages: Message[]): Promise<{
    messages: Message[];
    result: CompressionResult;
  }> {
    const classification = this.classifier.classify(messages);

    // Messages to keep: preserve + recent
    const keep = [...classification.preserve, ...classification.recent];

    // Messages to compress
    const toCompress = classification.compressible;

    if (toCompress.length === 0) {
      // Nothing to compress
      return {
        messages,
        result: this.createResult(false, messages.length, messages.length, 0, toCompress),
      };
    }

    // Generate summary
    console.log(`  📝 Summarizing ${toCompress.length} old messages...`);
    const summary = await this.summarizer.summarize(toCompress);

    // Create summary message
    const summaryMsg = this.summarizer.createSummaryMessage(
      messages[0]?.conversationId || 'unknown',
      summary,
      toCompress.length
    );

    // Reconstruct message array: summary + preserved + recent
    const compressed = [summaryMsg, ...keep];

    // Sort by timestamp to maintain order
    compressed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const tokensSaved = this.classifier.estimateTokens(toCompress) - 
                        this.classifier.estimateTokens([summaryMsg]);

    console.log(`  ✅ Compressed ${toCompress.length} messages → 1 summary (saved ~${tokensSaved} tokens)`);

    return {
      messages: compressed,
      result: this.createResult(true, messages.length, compressed.length, toCompress.length, toCompress, summary, tokensSaved),
    };
  }

  /**
   * Aggressive strategy:
   * - Keep only recent N messages
   * - Summarize everything else more aggressively
   */
  private async compressAggressive(messages: Message[]): Promise<{
    messages: Message[];
    result: CompressionResult;
  }> {
    // Similar to sliding-window but don't preserve initial messages
    const configOverride = { ...this.config, initialMessagesKeep: 0 };
    const classifierOverride = new MessageClassifier(configOverride);
    const classification = classifierOverride.classify(messages);

    const keep = [...classification.preserve, ...classification.recent];
    const toCompress = classification.compressible;

    if (toCompress.length === 0) {
      return {
        messages,
        result: this.createResult(false, messages.length, messages.length, 0, toCompress),
      };
    }

    const summary = await this.summarizer.summarize(toCompress);
    const summaryMsg = this.summarizer.createSummaryMessage(
      messages[0]?.conversationId || 'unknown',
      summary,
      toCompress.length
    );

    const compressed = [summaryMsg, ...keep];
    compressed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const tokensSaved = this.classifier.estimateTokens(toCompress) - 
                        this.classifier.estimateTokens([summaryMsg]);

    return {
      messages: compressed,
      result: this.createResult(true, messages.length, compressed.length, toCompress.length, toCompress, summary, tokensSaved),
    };
  }

  /**
   * Preserve-first strategy:
   * - Keep first N messages (context grounding)
   * - Keep recent N messages
   * - Summarize middle section
   */
  private async compressPreserveFirst(messages: Message[]): Promise<{
    messages: Message[];
    result: CompressionResult;
  }> {
    const classification = this.classifier.classify(messages);

    const keep = [
      ...classification.initial,
      ...classification.preserve,
      ...classification.recent,
    ];

    const toCompress = classification.compressible;

    if (toCompress.length === 0) {
      return {
        messages,
        result: this.createResult(false, messages.length, messages.length, 0, toCompress),
      };
    }

    const summary = await this.summarizer.summarize(toCompress);
    const summaryMsg = this.summarizer.createSummaryMessage(
      messages[0]?.conversationId || 'unknown',
      summary,
      toCompress.length
    );

    // Reconstruct: initial + summary + preserved + recent
    const compressed = [...classification.initial, summaryMsg, ...classification.preserve, ...classification.recent];
    compressed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const tokensSaved = this.classifier.estimateTokens(toCompress) - 
                        this.classifier.estimateTokens([summaryMsg]);

    return {
      messages: compressed,
      result: this.createResult(true, messages.length, compressed.length, toCompress.length, toCompress, summary, tokensSaved),
    };
  }

  /**
   * Create compression result object
   */
  private createResult(
    compressed: boolean,
    originalCount: number,
    newCount: number,
    messagesCompressed: number,
    compressedMsgs: Message[],
    summary?: string,
    tokensSaved?: number
  ): CompressionResult {
    return {
      compressed,
      originalCount,
      newCount,
      messagesCompressed,
      tokensSaved: tokensSaved || this.classifier.estimateTokens(compressedMsgs),
      summary,
      strategy: this.config.strategy,
      timestamp: Date.now(),
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.classifier = new MessageClassifier(this.config);
    this.summarizer = new MessageSummarizer(this.config, this.provider);
  }
}
