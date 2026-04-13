import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const STRUCTURED_LOG_DIR = process.env.STRUCTURED_LOG_DIR || './logs/structured';
const QUERY_LOG_FILE = path.join(STRUCTURED_LOG_DIR, 'query-loop.log');
const TASK_LOG_FILE = path.join(STRUCTURED_LOG_DIR, 'task-transitions.log');

// Ensure log directories exist
if (!fs.existsSync(STRUCTURED_LOG_DIR)) {
  fs.mkdirSync(STRUCTURED_LOG_DIR, { recursive: true });
}

/**
 * Structured Logger for DVACE Architecture
 * 
 * Logs three main event types:
 * 1. Tool Executions (via ToolAnalytics - already exists)
 * 2. Query Loop Cycles (this file)
 * 3. Task State Transitions (this file)
 */

// ============================================
// QUERY LOOP LOGGING
// ============================================

export interface QueryLoopEvent {
  eventId: string;
  timestamp: number;
  conversationId?: string;
  queryChainId: string;
  
  // Query loop metrics
  turnCount: number;
  toolExecutions: number;
  transition: 'START' | 'THINKING' | 'TOOL_USE' | 'SUCCESS' | 'ERROR' | 'MAX_ITER';
  finalState: 'completed' | 'error' | 'max_iterations' | 'in_progress';
  
  // Performance metrics
  duration: number;  // milliseconds
  avgToolDuration: number;  // milliseconds
  
  // Error tracking
  consecutiveErrors: number;
  errorMessage?: string;
  
  // Metadata
  userPrompt?: string;
  finalResponse?: string;
  compactionAttempted: boolean;
  recoveryAttempts: number;
}

export class QueryLoopLogger {
  private static instance: QueryLoopLogger | null = null;

  public static getInstance(): QueryLoopLogger {
    if (!QueryLoopLogger.instance) {
      QueryLoopLogger.instance = new QueryLoopLogger();
    }
    return QueryLoopLogger.instance;
  }

  /**
   * Log query loop completion
   */
  public logQueryLoop(event: Omit<QueryLoopEvent, 'eventId' | 'timestamp'>): void {
    const fullEvent: QueryLoopEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    this.writeLog(QUERY_LOG_FILE, fullEvent);

    // Console log for visibility
    const emoji = fullEvent.finalState === 'completed' ? '✅' :
                  fullEvent.finalState === 'error' ? '❌' :
                  fullEvent.finalState === 'max_iterations' ? '⚠️' : '⏳';
    
    console.log(
      `🔄 [QueryLoop] ${emoji} ${fullEvent.finalState.toUpperCase()} | ` +
      `Turns: ${fullEvent.turnCount} | ` +
      `Tools: ${fullEvent.toolExecutions} | ` +
      `Duration: ${fullEvent.duration}ms | ` +
      `Chain: ${fullEvent.queryChainId.slice(0, 8)}`
    );

    // Log errors prominently
    if (fullEvent.finalState === 'error' && fullEvent.errorMessage) {
      console.error(
        `🔄 [QueryLoop] ❌ ERROR: ${fullEvent.errorMessage}`
      );
    }

    // Warn on max iterations
    if (fullEvent.finalState === 'max_iterations') {
      console.warn(
        `🔄 [QueryLoop] ⚠️  MAX_ITERATIONS reached (${fullEvent.turnCount} turns) | ` +
        `Consecutive Errors: ${fullEvent.consecutiveErrors}`
      );
    }
  }

  /**
   * Get query loop statistics
   */
  public getQueryLoopStats(sinceTimestamp?: number): {
    totalQueries: number;
    completedQueries: number;
    errorQueries: number;
    maxIterQueries: number;
    avgTurns: number;
    avgToolExecutions: number;
    avgDuration: number;
  } {
    const events = this.readQueryEvents(sinceTimestamp);

    if (events.length === 0) {
      return {
        totalQueries: 0,
        completedQueries: 0,
        errorQueries: 0,
        maxIterQueries: 0,
        avgTurns: 0,
        avgToolExecutions: 0,
        avgDuration: 0,
      };
    }

    const completedQueries = events.filter(e => e.finalState === 'completed').length;
    const errorQueries = events.filter(e => e.finalState === 'error').length;
    const maxIterQueries = events.filter(e => e.finalState === 'max_iterations').length;

    const totalTurns = events.reduce((sum, e) => sum + e.turnCount, 0);
    const totalTools = events.reduce((sum, e) => sum + e.toolExecutions, 0);
    const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);

    return {
      totalQueries: events.length,
      completedQueries,
      errorQueries,
      maxIterQueries,
      avgTurns: totalTurns / events.length,
      avgToolExecutions: totalTools / events.length,
      avgDuration: totalDuration / events.length,
    };
  }

  private readQueryEvents(sinceTimestamp?: number): QueryLoopEvent[] {
    try {
      if (!fs.existsSync(QUERY_LOG_FILE)) {
        return [];
      }

      const content = fs.readFileSync(QUERY_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines
        .map(line => {
          try {
            return JSON.parse(line) as QueryLoopEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is QueryLoopEvent => e !== null)
        .filter(e => !sinceTimestamp || e.timestamp >= sinceTimestamp);
    } catch (error) {
      console.warn('⚠️  Failed to read query loop events:', error);
      return [];
    }
  }

  private writeLog(filePath: string, event: any): void {
    try {
      const logLine = JSON.stringify(event) + '\n';
      fs.appendFileSync(filePath, logLine, 'utf8');
    } catch (error) {
      // Non-critical: logging failure shouldn't break execution
      console.warn('⚠️  Failed to write structured log:', error);
    }
  }
}

// ============================================
// TASK TRANSITION LOGGING
// ============================================

export interface TaskTransitionEvent {
  eventId: string;
  timestamp: number;
  conversationId?: string;
  
  // Task identification
  taskId: string;
  phaseId?: string;
  phaseName?: string;
  phaseIndex?: number;
  
  // Transition details
  transitionType: 'TASK_CREATED' | 'TASK_STATUS_CHANGE' | 'PHASE_STATUS_CHANGE' | 'TOOL_EXECUTION';
  oldStatus?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';
  newStatus?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';
  
  // Metrics
  toolExecutions: number;
  phaseType?: 'planning' | 'execution' | 'validation';
  
  // Metadata
  reason?: string;
  errorMessage?: string;
}

export class TaskTransitionLogger {
  private static instance: TaskTransitionLogger | null = null;

  public static getInstance(): TaskTransitionLogger {
    if (!TaskTransitionLogger.instance) {
      TaskTransitionLogger.instance = new TaskTransitionLogger();
    }
    return TaskTransitionLogger.instance;
  }

  /**
   * Log task creation
   */
  public logTaskCreated(
    taskId: string,
    conversationId: string,
    phaseCount: number
  ): void {
    const event: TaskTransitionEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      conversationId,
      taskId,
      transitionType: 'TASK_CREATED',
      newStatus: 'pending',
      toolExecutions: 0,
    };

    this.writeLog(TASK_LOG_FILE, event);

    console.log(
      `📋 [Task] ✨ CREATED | ` +
      `ID: ${taskId.slice(0, 16)}... | ` +
      `Phases: ${phaseCount}`
    );
  }

  /**
   * Log task status change
   */
  public logTaskStatusChange(
    taskId: string,
    oldStatus: string,
    newStatus: string,
    toolExecutions: number,
    reason?: string
  ): void {
    const event: TaskTransitionEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      taskId,
      transitionType: 'TASK_STATUS_CHANGE',
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      toolExecutions,
      reason,
    };

    this.writeLog(TASK_LOG_FILE, event);

    const emoji = newStatus === 'completed' ? '✅' :
                  newStatus === 'failed' ? '❌' :
                  newStatus === 'killed' ? '🔴' :
                  newStatus === 'in_progress' ? '🔄' : '⏳';

    console.log(
      `📋 [Task] ${emoji} ${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()} | ` +
      `ID: ${taskId.slice(0, 16)}... | ` +
      `Tools: ${toolExecutions}` +
      (reason ? ` | Reason: ${reason}` : '')
    );
  }

  /**
   * Log phase status change
   */
  public logPhaseStatusChange(
    taskId: string,
    phaseId: string,
    phaseName: string,
    phaseIndex: number,
    oldStatus: string,
    newStatus: string,
    toolExecutions: number,
    phaseType?: 'planning' | 'execution' | 'validation'
  ): void {
    const event: TaskTransitionEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      taskId,
      phaseId,
      phaseName,
      phaseIndex,
      transitionType: 'PHASE_STATUS_CHANGE',
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      toolExecutions,
      phaseType,
    };

    this.writeLog(TASK_LOG_FILE, event);

    const emoji = newStatus === 'completed' ? '✅' :
                  newStatus === 'failed' ? '❌' :
                  newStatus === 'killed' ? '🔴' :
                  newStatus === 'in_progress' ? '🔄' : '⏳';

    console.log(
      `📋 [Phase] ${emoji} ${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()} | ` +
      `${phaseName} (#${phaseIndex}) | ` +
      `Tools: ${toolExecutions}` +
      (phaseType ? ` | Type: ${phaseType}` : '')
    );
  }

  /**
   * Log tool execution in phase
   */
  public logToolExecution(
    taskId: string,
    phaseId: string,
    phaseIndex: number,
    toolExecutions: number
  ): void {
    const event: TaskTransitionEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      taskId,
      phaseId,
      phaseIndex,
      transitionType: 'TOOL_EXECUTION',
      toolExecutions,
    };

    this.writeLog(TASK_LOG_FILE, event);

    console.log(
      `📋 [Phase] 🔧 TOOL_EXEC | ` +
      `Phase #${phaseIndex} | ` +
      `Total Tools: ${toolExecutions}`
    );
  }

  /**
   * Get task transition statistics
   */
  public getTaskStats(sinceTimestamp?: number): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    killedTasks: number;
    inProgressTasks: number;
    avgToolExecutions: number;
    phaseTransitions: number;
  } {
    const events = this.readTaskEvents(sinceTimestamp);

    if (events.length === 0) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        killedTasks: 0,
        inProgressTasks: 0,
        avgToolExecutions: 0,
        phaseTransitions: 0,
      };
    }

    const taskCreations = events.filter(e => e.transitionType === 'TASK_CREATED');
    const taskStatusChanges = events.filter(e => e.transitionType === 'TASK_STATUS_CHANGE');
    const phaseTransitions = events.filter(e => e.transitionType === 'PHASE_STATUS_CHANGE');

    const completedTasks = taskStatusChanges.filter(e => e.newStatus === 'completed').length;
    const failedTasks = taskStatusChanges.filter(e => e.newStatus === 'failed').length;
    const killedTasks = taskStatusChanges.filter(e => e.newStatus === 'killed').length;
    const inProgressTasks = taskStatusChanges.filter(e => e.newStatus === 'in_progress').length;

    const totalTools = taskStatusChanges.reduce((sum, e) => sum + e.toolExecutions, 0);

    return {
      totalTasks: taskCreations.length,
      completedTasks,
      failedTasks,
      killedTasks,
      inProgressTasks,
      avgToolExecutions: taskStatusChanges.length > 0 ? totalTools / taskStatusChanges.length : 0,
      phaseTransitions: phaseTransitions.length,
    };
  }

  private readTaskEvents(sinceTimestamp?: number): TaskTransitionEvent[] {
    try {
      if (!fs.existsSync(TASK_LOG_FILE)) {
        return [];
      }

      const content = fs.readFileSync(TASK_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines
        .map(line => {
          try {
            return JSON.parse(line) as TaskTransitionEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is TaskTransitionEvent => e !== null)
        .filter(e => !sinceTimestamp || e.timestamp >= sinceTimestamp);
    } catch (error) {
      console.warn('⚠️  Failed to read task transition events:', error);
      return [];
    }
  }

  private writeLog(filePath: string, event: any): void {
    try {
      const logLine = JSON.stringify(event) + '\n';
      fs.appendFileSync(filePath, logLine, 'utf8');
    } catch (error) {
      // Non-critical: logging failure shouldn't break execution
      console.warn('⚠️  Failed to write structured log:', error);
    }
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const queryLoopLogger = QueryLoopLogger.getInstance();
export const taskTransitionLogger = TaskTransitionLogger.getInstance();
