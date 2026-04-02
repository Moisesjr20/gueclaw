import { Message } from '../../types';
import { CompressionConfig, MessageClassification } from './types';

/**
 * Classifies messages into categories for compression logic
 */
export class MessageClassifier {
  constructor(private config: CompressionConfig) {}

  /**
   * Classify messages into preserve, recent, compressible, and initial
   */
  public classify(messages: Message[]): MessageClassification {
    const result: MessageClassification = {
      preserve: [],
      recent: [],
      compressible: [],
      initial: [],
    };

    // If no messages, return empty classification
    if (messages.length === 0) {
      return result;
    }

    // Sort messages by timestamp (oldest first)
    const sorted = [...messages].sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeA - timeB;
    });

    // Step 1: Extract messages that should always be preserved
    const { preserve, remaining } = this.extractPreserveMessages(sorted);
    result.preserve = preserve;

    // Step 2: Extract recent messages (sliding window)
    const { recent, older } = this.extractRecentMessages(remaining);
    result.recent = recent;

    // Step 3: Extract initial messages (if configured)
    const { initial, middle } = this.extractInitialMessages(older);
    result.initial = initial;

    // Step 4: Everything else is compressible
    result.compressible = middle;

    return result;
  }

  /**
   * Extract messages that should always be preserved
   * - System messages (if config.preserveSystemMessages = true)
   * - Tool calls and responses (if config.preserveToolCalls = true)
   */
  private extractPreserveMessages(messages: Message[]): {
    preserve: Message[];
    remaining: Message[];
  } {
    const preserve: Message[] = [];
    const remaining: Message[] = [];

    for (const msg of messages) {
      let shouldPreserve = false;

      // Preserve system messages
      if (this.config.preserveSystemMessages && msg.role === 'system') {
        shouldPreserve = true;
      }

      // Preserve tool calls and tool responses
      if (this.config.preserveToolCalls) {
        if (msg.role === 'tool' || msg.toolCalls?.length) {
          shouldPreserve = true;
        }
      }

      if (shouldPreserve) {
        preserve.push(msg);
      } else {
        remaining.push(msg);
      }
    }

    return { preserve, remaining };
  }

  /**
   * Extract recent messages (sliding window)
   */
  private extractRecentMessages(messages: Message[]): {
    recent: Message[];
    older: Message[];
  } {
    const windowSize = this.config.recentMessagesWindow;

    if (messages.length <= windowSize) {
      return { recent: messages, older: [] };
    }

    // Take last N messages as recent
    const recent = messages.slice(-windowSize);
    const older = messages.slice(0, -windowSize);

    return { recent, older };
  }

  /**
   * Extract initial messages (conversation grounding)
   */
  private extractInitialMessages(messages: Message[]): {
    initial: Message[];
    middle: Message[];
  } {
    const initialKeep = this.config.initialMessagesKeep;

    if (initialKeep === 0 || messages.length <= initialKeep) {
      return { initial: [], middle: messages };
    }

    const initial = messages.slice(0, initialKeep);
    const middle = messages.slice(initialKeep);

    return { initial, middle };
  }

  /**
   * Check if message should be preserved
   */
  public shouldPreserve(message: Message): boolean {
    // System messages
    if (this.config.preserveSystemMessages && message.role === 'system') {
      return true;
    }

    // Tool calls
    if (this.config.preserveToolCalls) {
      if (message.role === 'tool' || message.toolCalls?.length) {
        return true;
      }
    }

    return false;
  }

  /**
   * Estimate token count for a message (approximate)
   * Rule of thumb: 1 token ≈ 4 characters in English, ~3 chars in Portuguese
   */
  public estimateTokens(messages: Message[]): number {
    const totalChars = messages.reduce((sum, msg) => {
      return sum + (msg.content?.length || 0);
    }, 0);

    // Average 3.5 characters per token (considering mixed English/Portuguese)
    return Math.ceil(totalChars / 3.5);
  }
}
