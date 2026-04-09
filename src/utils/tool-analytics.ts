import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const ANALYTICS_LOG_DIR = process.env.ANALYTICS_LOG_DIR || './logs/analytics';
const ANALYTICS_LOG_FILE = path.join(ANALYTICS_LOG_DIR, 'tool-execution.log');

// Ensure analytics log directory exists
if (!fs.existsSync(ANALYTICS_LOG_DIR)) {
  fs.mkdirSync(ANALYTICS_LOG_DIR, { recursive: true });
}

export interface ToolExecutionEvent {
  eventId: string;
  timestamp: number;
  toolName: string;
  conversationId?: string;
  queryChainId: string;
  queryDepth: number;
  iteration: number;
  args: Record<string, any>;
  result: {
    success: boolean;
    output?: string;
    error?: string;
  };
  duration: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface ToolExecutionSummary {
  toolName: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  lastCalled: number;
}

/**
 * Tool Analytics System
 * Tracks tool execution metrics, errors, and performance
 */
export class ToolAnalytics {
  private static instance: ToolAnalytics | null = null;
  private queryChainId: string = randomUUID();
  private queryDepth: number = 0;

  public static getInstance(): ToolAnalytics {
    if (!ToolAnalytics.instance) {
      ToolAnalytics.instance = new ToolAnalytics();
    }
    return ToolAnalytics.instance;
  }

  /**
   * Initialize new query chain (call at start of agent loop)
   */
  public initQueryChain(conversationId?: string): string {
    this.queryChainId = randomUUID();
    this.queryDepth = 0;
    
    // Log chain initialization
    const event = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      type: 'QUERY_CHAIN_INIT',
      queryChainId: this.queryChainId,
      conversationId,
    };
    
    this.writeLog(event);
    return this.queryChainId;
  }

  /**
   * Increment query depth (call at each iteration)
   */
  public incrementDepth(): void {
    this.queryDepth++;
  }

  /**
   * Get current query chain ID
   */
  public getQueryChainId(): string {
    return this.queryChainId;
  }

  /**
   * Get current query depth
   */
  public getQueryDepth(): number {
    return this.queryDepth;
  }

  /**
   * Log tool execution event
   */
  public logToolExecution(event: Omit<ToolExecutionEvent, 'eventId' | 'timestamp' | 'queryChainId' | 'queryDepth'>): void {
    const fullEvent: ToolExecutionEvent = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      queryChainId: this.queryChainId,
      queryDepth: this.queryDepth,
      ...event,
    };

    this.writeLog(fullEvent);
    
    // Console log for important events
    const emoji = fullEvent.result.success ? '✅' : '❌';
    const status = fullEvent.result.success ? 'SUCCESS' : 'FAILED';
    console.log(
      `📊 [Analytics] ${emoji} ${fullEvent.toolName} | ` +
      `${status} | ${fullEvent.duration}ms | ` +
      `Chain: ${this.queryChainId.slice(0, 8)} | Depth: ${this.queryDepth}`
    );
  }

  /**
   * Log error event with full context
   */
  public logError(
    toolName: string,
    error: string,
    iteration: number,
    args: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const event = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      type: 'TOOL_ERROR',
      toolName,
      queryChainId: this.queryChainId,
      queryDepth: this.queryDepth,
      iteration,
      error,
      args,
      metadata,
    };

    this.writeLog(event);
    
    console.error(
      `📊 [Analytics] ❌ ERROR in ${toolName} | ` +
      `Chain: ${this.queryChainId.slice(0, 8)} | ` +
      `Iteration: ${iteration} | Error: ${error.slice(0, 100)}`
    );
  }

  /**
   * Write log entry to file
   */
  private writeLog(event: any): void {
    try {
      const logLine = JSON.stringify(event) + '\n';
      fs.appendFileSync(ANALYTICS_LOG_FILE, logLine, 'utf8');
    } catch (error) {
      // Non-critical: analytics failure shouldn't break execution
      console.warn('⚠️  Failed to write analytics log:', error);
    }
  }

  /**
   * Get summary statistics for a tool
   */
  public getToolSummary(toolName: string, sinceTimestamp?: number): ToolExecutionSummary {
    const events = this.readToolEvents(toolName, sinceTimestamp);
    
    if (events.length === 0) {
      return {
        toolName,
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        avgDuration: 0,
        lastCalled: 0,
      };
    }

    const successCount = events.filter(e => e.result?.success).length;
    const totalDuration = events.reduce((sum, e) => sum + (e.duration || 0), 0);
    const lastCalled = Math.max(...events.map(e => e.timestamp));

    return {
      toolName,
      totalCalls: events.length,
      successCount,
      failureCount: events.length - successCount,
      avgDuration: events.length > 0 ? totalDuration / events.length : 0,
      lastCalled,
    };
  }

  /**
   * Read tool execution events from log file
   */
  private readToolEvents(toolName: string, sinceTimestamp?: number): ToolExecutionEvent[] {
    try {
      if (!fs.existsSync(ANALYTICS_LOG_FILE)) {
        return [];
      }

      const content = fs.readFileSync(ANALYTICS_LOG_FILE, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      return lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(event => 
          event && 
          event.toolName === toolName &&
          (!sinceTimestamp || event.timestamp >= sinceTimestamp)
        );
    } catch (error) {
      console.warn('⚠️  Failed to read analytics log:', error);
      return [];
    }
  }

  /**
   * Get all events for current query chain
   */
  public getChainEvents(): any[] {
    try {
      if (!fs.existsSync(ANALYTICS_LOG_FILE)) {
        return [];
      }

      const content = fs.readFileSync(ANALYTICS_LOG_FILE, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      return lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(event => event && event.queryChainId === this.queryChainId);
    } catch (error) {
      console.warn('⚠️  Failed to read chain events:', error);
      return [];
    }
  }

  /**
   * Clear old logs (older than days)
   */
  public clearOldLogs(days: number = 30): void {
    try {
      if (!fs.existsSync(ANALYTICS_LOG_FILE)) {
        return;
      }

      const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
      const content = fs.readFileSync(ANALYTICS_LOG_FILE, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const recentLines = lines.filter(line => {
        try {
          const event = JSON.parse(line);
          return event.timestamp >= cutoffTimestamp;
        } catch {
          return false;
        }
      });

      fs.writeFileSync(ANALYTICS_LOG_FILE, recentLines.join('\n') + '\n', 'utf8');
      console.log(`📊 [Analytics] Cleared logs older than ${days} days`);
    } catch (error) {
      console.warn('⚠️  Failed to clear old logs:', error);
    }
  }
}
