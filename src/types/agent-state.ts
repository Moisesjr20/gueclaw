/**
 * Agent Loop State Tracking
 * Maintains state information across iterations for better control and observability
 */

export interface AgentLoopState {
  // Turn/iteration tracking
  turnCount: number;
  
  // State transitions (for debugging complex flows)
  lastTransition: string;
  transitionHistory: string[];
  
  // Recovery tracking (across all tools)
  recoveryAttempts: Map<string, number>;
  
  // Context management flags
  hasAttemptedCompaction: boolean;
  hasAttemptedTokenReduction: boolean;
  
  // Error tracking
  consecutiveErrors: number;
  lastError?: {
    toolName: string;
    error: string;
    iteration: number;
  };
  
  // Performance metrics
  totalToolExecutions: number;
  totalToolDuration: number;
  
  // Metadata
  startTime: number;
  lastUpdateTime: number;
}

/**
 * Create initial state
 */
export function createInitialState(): AgentLoopState {
  return {
    turnCount: 0,
    lastTransition: 'INIT',
    transitionHistory: ['INIT'],
    recoveryAttempts: new Map(),
    hasAttemptedCompaction: false,
    hasAttemptedTokenReduction: false,
    consecutiveErrors: 0,
    totalToolExecutions: 0,
    totalToolDuration: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  };
}

/**
 * Update state with transition
 */
export function updateState(
  state: AgentLoopState,
  transition: string
): AgentLoopState {
  return {
    ...state,
    lastTransition: transition,
    transitionHistory: [...state.transitionHistory, transition],
    lastUpdateTime: Date.now(),
  };
}

/**
 * Record state transition types
 */
export enum StateTransition {
  INIT = 'INIT',
  ITERATION_START = 'ITERATION_START',
  LLM_THINKING = 'LLM_THINKING',
  TOOL_EXECUTION = 'TOOL_EXECUTION',
  TOOL_SUCCESS = 'TOOL_SUCCESS',
  TOOL_FAILURE = 'TOOL_FAILURE',
  LOOP_DETECTED = 'LOOP_DETECTED',
  RECOVERY_ATTEMPT = 'RECOVERY_ATTEMPT',
  TRUNCATION_DETECTED = 'TRUNCATION_DETECTED',
  MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

/**
 * Get state summary for logging
 */
export function getStateSummary(state: AgentLoopState): string {
  const elapsed = Date.now() - state.startTime;
  const avgToolDuration = state.totalToolExecutions > 0 
    ? state.totalToolDuration / state.totalToolExecutions 
    : 0;
  
  return (
    `State Summary:\n` +
    `  Turns: ${state.turnCount}\n` +
    `  Last Transition: ${state.lastTransition}\n` +
    `  Tool Executions: ${state.totalToolExecutions}\n` +
    `  Avg Tool Duration: ${avgToolDuration.toFixed(2)}ms\n` +
    `  Consecutive Errors: ${state.consecutiveErrors}\n` +
    `  Elapsed Time: ${elapsed}ms\n` +
    `  Compaction Attempted: ${state.hasAttemptedCompaction}\n` +
    `  Recovery Attempts: ${state.recoveryAttempts.size}`
  );
}
