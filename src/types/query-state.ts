/**
 * Query State Types (DVACE Architecture - Phase 2.1)
 * 
 * Tracks state, transitions, and tool executions throughout the query loop.
 * Essential for preventing false positives of "success without execution".
 */

import { Message, ToolCall } from './index';

/**
 * Continue reasons - why the query loop continues or terminates
 */
export type ContinueReason = 
  | 'tool_use'      // LLM requested tool execution, must continue
  | 'end_turn'      // LLM finished turn naturally
  | 'stop'          // LLM explicitly stopped
  | 'max_turns'     // Exceeded MAX_ITERATIONS
  | 'length'        // Output length limit reached
  | 'error';        // Error occurred

/**
 * Tool execution record - tracks actual tool invocations
 */
export interface ToolExecution {
  /**
   * Tool name (e.g., 'FileRead', 'Bash', 'SSHExec')
   */
  tool: string;
  
  /**
   * Tool input parameters
   */
  input: Record<string, any>;
  
  /**
   * Tool output (stdout, result, etc)
   */
  output: string;
  
  /**
   * Execution success/failure
   */
  success: boolean;
  
  /**
   * Error message if failed
   */
  error?: string;
  
  /**
   * Timestamp of execution (Unix milliseconds)
   */
  timestamp: number;
  
  /**
   * Execution duration in milliseconds
   */
  duration: number;
  
  /**
   * ToolCall ID that triggered this execution
   */
  toolCallId?: string;
  
  /**
   * Iteration/turn number when executed
   */
  iteration: number;
}

/**
 * Tool Use Context - additional context for tool execution
 */
export interface ToolUseContext {
  /**
   * User ID making the request
   */
  userId: string;
  
  /**
   * Conversation ID
   */
  conversationId: string;
  
  /**
   * Working directory (for file/bash operations)
   */
  workingDirectory?: string;
  
  /**
   * Environment variables
   */
  environment?: Record<string, string>;
  
  /**
   * Allowed tools (for PromptCommand restrictions)
   */
  allowedTools?: string[];
  
  /**
   * Blocked tools (never allowed)
   */
  blockedTools?: string[];
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Query State - complete state of a query loop execution
 * 
 * CRITICAL: This state is used to validate that tool executions actually happened.
 * A query should NEVER be marked as successful if:
 * - transition === 'tool_use' (still waiting for tool results)
 * - toolExecutions.length === 0 (no tools were executed when they should have been)
 */
export interface QueryState {
  /**
   * Message history (system, user, assistant, tool)
   */
  messages: Message[];
  
  /**
   * Tool use context
   */
  toolUseContext: ToolUseContext;
  
  /**
   * Current turn/iteration count
   */
  turnCount: number;
  
  /**
   * Current transition state
   * 
   * CRITICAL VALIDATION:
   * - If transition === 'tool_use', the loop MUST continue to execute tools
   * - Only 'end_turn' or 'stop' are valid terminal states
   * - NEVER mark query as complete if transition === 'tool_use'
   */
  transition: ContinueReason | undefined;
  
  /**
   * History of all tool executions in this query
   * 
   * CRITICAL VALIDATION:
   * - If LLM requested tools (finishReason === 'tool_calls'), this MUST grow
   * - Empty array + tool_calls = BUG (tool execution was skipped)
   */
  toolExecutions: ToolExecution[];
  
  /**
   * Start time (Unix milliseconds)
   */
  startTime: number;
  
  /**
   * Last update time (Unix milliseconds)
   */
  lastUpdateTime: number;
  
  /**
   * Total tokens used (prompt + completion)
   */
  totalTokens: number;
  
  /**
   * Query chain ID (for analytics)
   */
  queryChainId?: string;
  
  /**
   * Final response text (only set when query completes)
   */
  finalResponse?: string;
  
  /**
   * Error that terminated the query (if any)
   */
  error?: string;
}

/**
 * Query Parameters - input to queryLoop()
 */
export interface QueryParams {
  /**
   * User input prompt
   */
  prompt: string;
  
  /**
   * LLM Provider instance
   */
  provider: any; // ILLMProvider (avoid circular dependency)
  
  /**
   * Conversation history
   */
  conversationHistory?: Message[];
  
  /**
   * System prompt
   */
  systemPrompt?: string;
  
  /**
   * Enrichment (prepended to system prompt)
   */
  enrichment?: string;
  
  /**
   * Tool use context
   */
  toolUseContext: ToolUseContext;
  
  /**
   * Maximum iterations (default: from env)
   */
  maxIterations?: number;
  
  /**
   * Query chain ID (for analytics)
   */
  queryChainId?: string;
}

/**
 * Create initial query state
 */
export function createInitialQueryState(params: QueryParams): QueryState {
  return {
    messages: params.conversationHistory || [],
    toolUseContext: params.toolUseContext,
    turnCount: 0,
    transition: undefined,
    toolExecutions: [],
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    totalTokens: 0,
    queryChainId: params.queryChainId
  };
}

/**
 * Validate query completion
 * 
 * CRITICAL: This function ensures we never mark a query as "complete" if:
 * 1. The last transition was 'tool_use' (still waiting for tool results)
 * 2. Tools were requested but never executed
 * 
 * @param state - Current query state
 * @returns true if query can safely complete
 * @throws Error if validation fails
 */
export function validateQueryCompletion(state: QueryState): boolean {
  // Rule 1: Cannot complete if transition is 'tool_use'
  if (state.transition === 'tool_use') {
    throw new Error(
      `VALIDATION FAILED: Query cannot complete with transition='tool_use'. ` +
      `This indicates tool execution was skipped. ` +
      `Turn: ${state.turnCount}, Tools executed: ${state.toolExecutions.length}`
    );
  }
  
  // Rule 2: If last message is assistant with tool_calls, we need tool_result messages
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.role === 'assistant' && lastMessage.toolCalls && lastMessage.toolCalls.length > 0) {
    // Check if there are tool_result messages after the assistant message
    const hasToolResults = state.messages[state.messages.length - 1]?.role === 'tool';
    
    if (!hasToolResults) {
      throw new Error(
        `VALIDATION FAILED: Assistant requested ${lastMessage.toolCalls.length} tool(s) ` +
        `but no tool_result messages found. This indicates tool execution was skipped. ` +
        `Turn: ${state.turnCount}, Tools executed: ${state.toolExecutions.length}`
      );
    }
  }
  
  return true;
}

/**
 * Record a tool execution in the state
 */
export function recordToolExecution(state: QueryState, execution: ToolExecution): QueryState {
  return {
    ...state,
    toolExecutions: [...state.toolExecutions, execution],
    lastUpdateTime: Date.now(),
    totalTokens: state.totalTokens // Will be updated separately
  };
}

/**
 * Update query transition
 */
export function updateQueryTransition(state: QueryState, transition: ContinueReason): QueryState {
  return {
    ...state,
    transition,
    lastUpdateTime: Date.now()
  };
}

/**
 * Get query state summary (for logging/debugging)
 */
export function getQueryStateSummary(state: QueryState): string {
  const elapsed = state.lastUpdateTime - state.startTime;
  const elapsedSec = (elapsed / 1000).toFixed(1);
  
  return [
    `📊 Query State Summary`,
    `   Turn: ${state.turnCount}`,
    `   Transition: ${state.transition || 'INIT'}`,
    `   Tool Executions: ${state.toolExecutions.length}`,
    `   Messages: ${state.messages.length}`,
    `   Elapsed: ${elapsedSec}s`,
    `   Tokens: ${state.totalTokens}`,
  ].join('\n');
}
