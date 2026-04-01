/**
 * Skill Execution Types
 * 
 * Types for forked and normal skill execution
 */

import { Message } from '../types';

/**
 * Options for forked skill execution
 */
export interface ForkedExecutionOptions {
  /** Maximum tokens for the forked agent */
  maxTokens?: number;
  /** Maximum iterations/turns in the agent loop */
  maxIterations?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to use reasoning provider */
  useReasoning?: boolean;
  /** Extra context to prepend to system prompt */
  extraContext?: string;
  /** Conversation ID for tracking */
  conversationId?: string;
}

/**
 * Result from forked skill execution
 */
export interface ForkedExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Final output text */
  output: string;
  /** All messages generated during forked execution */
  messages: Message[];
  /** Tokens used (if tracked) */
  tokensUsed?: number;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Execution mode for skills
 */
export type SkillExecutionMode = 'normal' | 'forked';

/**
 * Context isolation level
 */
export enum IsolationLevel {
  /** Full isolation - new history, new provider instance */
  FULL = 'full',
  /** Partial isolation - shared provider, isolated history */
  PARTIAL = 'partial',
  /** No isolation - shared everything (normal mode) */
  NONE = 'none',
}
