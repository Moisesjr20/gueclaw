/**
 * Forked Agent Utilities
 * 
 * Helper functions for forked skill execution with context isolation.
 * Inspired by Claude Code's forkedAgent.ts architecture.
 */

import { Message } from '../types';

/**
 * Clone conversation history to prevent mutation of parent context
 */
export function cloneConversationHistory(messages: Message[]): Message[] {
  // Deep clone to ensure complete isolation
  return messages.map(msg => ({
    ...msg,
    content: msg.content, // String is immutable, no need for deep clone
    metadata: msg.metadata ? { ...msg.metadata } : undefined,
    toolCalls: msg.toolCalls ? [...msg.toolCalls] : undefined,
  }));
}

/**
 * Extract final result text from forked execution messages
 */
export function extractForkedResult(
  messages: Message[],
  defaultText = 'Execution completed'
): string {
  // Find last assistant message
  const lastAssistantMsg = messages
    .filter(m => m.role === 'assistant')
    .pop();

  if (!lastAssistantMsg || !lastAssistantMsg.content) {
    return defaultText;
  }

  // content is always a string per Message type definition
  return lastAssistantMsg.content || defaultText;
}

/**
 * Create isolated execution context
 * Returns a clean context object for forked execution
 */
export function createIsolatedContext(baseContext: {
  conversationHistory: Message[];
  systemPrompt: string;
  maxIterations?: number;
}): {
  conversationHistory: Message[];
  systemPrompt: string;
  maxIterations: number;
} {
  return {
    conversationHistory: cloneConversationHistory(baseContext.conversationHistory),
    systemPrompt: baseContext.systemPrompt,
    maxIterations: baseContext.maxIterations || 5,
  };
}

/**
 * Estimate tokens used (rough approximation)
 * More accurate tracking would require provider-specific implementation
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens from messages
 */
export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content);
    return total + estimateTokens(content);
  }, 0);
}

/**
 * Validate forked execution options
 */
export function validateForkedOptions(options: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (options.maxTokens !== undefined) {
    if (typeof options.maxTokens !== 'number' || options.maxTokens <= 0) {
      errors.push('maxTokens must be a positive number');
    }
  }

  if (options.maxIterations !== undefined) {
    if (typeof options.maxIterations !== 'number' || options.maxIterations <= 0) {
      errors.push('maxIterations must be a positive number');
    }
  }

  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number' || options.timeout <= 0) {
      errors.push('timeout must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create timeout promise for forked execution
 */
export function createExecutionTimeout(
  timeoutMs: number
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Forked execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Execute with timeout
 */
export async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    createExecutionTimeout(timeoutMs),
  ]);
}
