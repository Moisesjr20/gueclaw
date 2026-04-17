import { DatabaseConnection } from '../memory/database';
import { randomUUID } from 'crypto';

/**
 * Skill Execution Record
 */
export interface SkillExecution {
  id: string;
  skillName: string;
  userId: string;
  success: boolean;
  errorMessage?: string;
  errorType?: string;
  context?: string;
  executionTimeMs?: number;
  timestamp: number;
}

/**
 * Failure Pattern Detection
 */
export interface FailurePattern {
  skillName: string;
  normalizedError: string;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  errorType: string;
  contexts: string[];
}

/**
 * Tracks skill executions and detects failure patterns for auto-improvement
 */
export class SkillExecutionTracker {
  private static db: any;

  /**
   * Initialize tracker (ensure database connection)
   */
  public static initialize(): void {
    SkillExecutionTracker.db = DatabaseConnection.getInstance();
    console.log('✅ Skill Execution Tracker initialized');
  }

  /**
   * Track a skill execution (success or failure)
   * @param execution - Execution details
   */
  public static track(execution: Omit<SkillExecution, 'id' | 'timestamp'>): void {
    if (!SkillExecutionTracker.db) {
      SkillExecutionTracker.initialize();
    }

    const id = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    const stmt = SkillExecutionTracker.db.prepare(`
      INSERT INTO skill_executions (
        id, skill_name, user_id, success, error_message, error_type, context, execution_time_ms, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      execution.skillName,
      execution.userId,
      execution.success ? 1 : 0,
      execution.errorMessage || null,
      execution.errorType || null,
      execution.context || null,
      execution.executionTimeMs || null,
      timestamp
    );

    console.log(`📊 [SkillTracker] ${execution.skillName}: ${execution.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
  }

  /**
   * Get recent failures for a skill (last 24 hours)
   * @param skillName - Name of the skill
   * @param hoursWindow - Time window in hours (default: 24)
   * @returns Array of failed executions
   */
  public static getRecentFailures(skillName: string, hoursWindow: number = 24): SkillExecution[] {
    if (!SkillExecutionTracker.db) {
      SkillExecutionTracker.initialize();
    }

    const windowStart = Math.floor(Date.now() / 1000) - (hoursWindow * 3600);

    const stmt = SkillExecutionTracker.db.prepare(`
      SELECT * FROM skill_executions
      WHERE skill_name = ? AND success = 0 AND timestamp >= ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(skillName, windowStart);

    return rows.map((row: any) => ({
      id: row.id,
      skillName: row.skill_name,
      userId: row.user_id,
      success: row.success === 1,
      errorMessage: row.error_message,
      errorType: row.error_type,
      context: row.context,
      executionTimeMs: row.execution_time_ms,
      timestamp: row.timestamp
    }));
  }

  /**
   * Detect failure patterns (group similar errors)
   * @param skillName - Name of the skill
   * @param minOccurrences - Minimum occurrences to consider a pattern (default: 3)
   * @param hoursWindow - Time window in hours (default: 24)
   * @returns Detected failure patterns
   */
  public static detectFailurePattern(
    skillName: string,
    minOccurrences: number = 3,
    hoursWindow: number = 24
  ): FailurePattern | null {
    const failures = SkillExecutionTracker.getRecentFailures(skillName, hoursWindow);

    if (failures.length < minOccurrences) {
      return null;
    }

    // Group by normalized error
    const grouped = new Map<string, SkillExecution[]>();
    
    for (const failure of failures) {
      if (!failure.errorMessage) continue;
      
      const normalized = SkillExecutionTracker.normalizeError(failure.errorMessage);
      
      if (!grouped.has(normalized)) {
        grouped.set(normalized, []);
      }
      grouped.get(normalized)!.push(failure);
    }

    // Find pattern with most occurrences
    let bestPattern: FailurePattern | null = null;
    let maxCount = 0;

    for (const [normalizedError, occurrences] of grouped.entries()) {
      if (occurrences.length >= minOccurrences && occurrences.length > maxCount) {
        maxCount = occurrences.length;
        
        const timestamps = occurrences.map(o => o.timestamp);
        const contexts = occurrences
          .filter(o => o.context)
          .map(o => o.context!)
          .filter((v, i, a) => a.indexOf(v) === i); // unique

        bestPattern = {
          skillName,
          normalizedError,
          count: occurrences.length,
          firstOccurrence: Math.min(...timestamps),
          lastOccurrence: Math.max(...timestamps),
          errorType: occurrences[0].errorType || 'unknown',
          contexts
        };
      }
    }

    return bestPattern;
  }

  /**
   * Normalize error message (remove timestamps, IDs, paths with line numbers, etc.)
   * @param errorMessage - Raw error message
   * @returns Normalized error message
   */
  public static normalizeError(errorMessage: string): string {
    let normalized = errorMessage;

    // Remove UUIDs
    normalized = normalized.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');

    // Remove timestamps (ISO 8601)
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '<TIMESTAMP>');

    // Remove Unix timestamps
    normalized = normalized.replace(/\b\d{10,13}\b/g, '<UNIX_TIMESTAMP>');

    // Remove file paths with line numbers
    normalized = normalized.replace(/([a-zA-Z]:\\|\/)[^\s:]+:\d+/g, '<FILE_PATH>');

    // Remove absolute paths
    normalized = normalized.replace(/([a-zA-Z]:\\|\/)[^\s]+/g, '<PATH>');

    // Remove numbers that might be dynamic (IDs, ports, etc.)
    normalized = normalized.replace(/\b\d{4,}\b/g, '<NUMBER>');

    // Remove email addresses
    normalized = normalized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '<EMAIL>');

    // Remove IP addresses
    normalized = normalized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>');

    // Remove URLs
    normalized = normalized.replace(/https?:\/\/[^\s]+/g, '<URL>');

    // Trim whitespace
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Get failure statistics for a skill
   * @param skillName - Name of the skill
   * @param daysWindow - Time window in days (default: 7)
   * @returns Statistics object
   */
  public static getFailureStats(skillName: string, daysWindow: number = 7): {
    totalExecutions: number;
    totalFailures: number;
    failureRate: number;
    recentFailures: number;
    hasPattern: boolean;
  } {
    if (!SkillExecutionTracker.db) {
      SkillExecutionTracker.initialize();
    }

    const windowStart = Math.floor(Date.now() / 1000) - (daysWindow * 86400);

    const stmt = SkillExecutionTracker.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
      FROM skill_executions
      WHERE skill_name = ? AND timestamp >= ?
    `);

    const row = stmt.get(skillName, windowStart);
    const totalExecutions = row.total || 0;
    const totalFailures = row.failures || 0;
    const failureRate = totalExecutions > 0 ? totalFailures / totalExecutions : 0;

    const recentFailures = SkillExecutionTracker.getRecentFailures(skillName, 24).length;
    const pattern = SkillExecutionTracker.detectFailurePattern(skillName, 3, 24);
    const hasPattern = pattern !== null;

    return {
      totalExecutions,
      totalFailures,
      failureRate,
      recentFailures,
      hasPattern
    };
  }

  /**
   * Clear old executions (cleanup)
   * @param daysToKeep - Keep executions from last N days (default: 30)
   */
  public static cleanupOldExecutions(daysToKeep: number = 30): number {
    if (!SkillExecutionTracker.db) {
      SkillExecutionTracker.initialize();
    }

    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysToKeep * 86400);

    const stmt = SkillExecutionTracker.db.prepare(`
      DELETE FROM skill_executions WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffTimestamp);
    const deleted = result.changes || 0;

    console.log(`🧹 [SkillTracker] Cleaned up ${deleted} old executions (kept last ${daysToKeep} days)`);
    return deleted;
  }
}
