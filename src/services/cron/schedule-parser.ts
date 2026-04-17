/**
 * Schedule Parser
 * 
 * Parses different schedule formats and calculates next execution time.
 */

import CronParser from 'cron-parser';
import type { CronSchedule } from './cron-types';

/**
 * Parse schedule string into CronSchedule object
 * 
 * Supports multiple formats:
 * - "30m", "2h", "1d" - Interval (every X minutes/hours/days)
 * - "every 30m", "every 2h" - Interval with prefix
 * - "0 7 * * *" - Cron expression
 * - "2026-04-17T14:00:00Z" - ISO timestamp (once)
 * - "2m" - Relative time (2 minutes from now, once)
 * 
 * @param scheduleStr Schedule string to parse
 * @returns Parsed CronSchedule object
 * @throws Error if format is invalid
 */
export function parse(scheduleStr: string): CronSchedule {
  const trimmed = scheduleStr.trim();

  // Try ISO timestamp (once)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return {
      type: 'once',
      value: trimmed,
      description: `Once at ${new Date(trimmed).toLocaleString()}`
    };
  }

  // Try relative time for "once" (e.g., "2m" = 2 minutes from now)
  const relativeMatch = trimmed.match(/^(\d+)(m|h|d)$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    
    // Check if it's meant as interval (prefixed with "every")
    if (trimmed.startsWith('every ')) {
      return parseInterval(trimmed.replace('every ', ''));
    }

    // Otherwise, treat as "once" (relative time from now)
    const now = Date.now();
    const multiplier = unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
    const targetTime = new Date(now + amount * multiplier);

    return {
      type: 'once',
      value: targetTime.toISOString(),
      description: `Once in ${amount}${unit} (at ${targetTime.toLocaleString()})`
    };
  }

  // Try "every X" interval format
  if (trimmed.startsWith('every ')) {
    return parseInterval(trimmed.substring(6));
  }

  // Try cron expression (5 or 6 fields)
  if (/^[\d*,\-/\s]+$/.test(trimmed)) {
    try {
      CronParser.parse(trimmed);
      return {
        type: 'cron',
        value: trimmed,
        description: describeCron(trimmed)
      };
    } catch (error) {
      throw new Error(`Invalid cron expression: ${trimmed}`);
    }
  }

  throw new Error(`Invalid schedule format: ${trimmed}`);
}

/**
 * Parse interval format (e.g., "30m", "2h", "1d")
 */
function parseInterval(intervalStr: string): CronSchedule {
  const match = intervalStr.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid interval format: ${intervalStr}`);
  }

  const amount = parseInt(match[1]);
  const unit = match[2];

  const unitNames: Record<string, string> = {
    m: 'minutes',
    h: 'hours',
    d: 'days'
  };

  return {
    type: 'interval',
    value: intervalStr,
    description: `Every ${amount} ${unitNames[unit]}`
  };
}

/**
 * Calculate next execution time for a schedule
 * 
 * @param schedule Schedule configuration
 * @param fromTime Starting point (default: now)
 * @returns Next execution timestamp
 */
export function calculateNextRun(schedule: CronSchedule, fromTime: Date = new Date()): Date {
  switch (schedule.type) {
    case 'once': {
      const targetTime = new Date(schedule.value);
      return targetTime > fromTime ? targetTime : fromTime;
    }

    case 'interval': {
      const match = schedule.value.match(/^(\d+)(m|h|d)$/);
      if (!match) {
        throw new Error(`Invalid interval: ${schedule.value}`);
      }

      const amount = parseInt(match[1]);
      const unit = match[2];
      const multiplier = unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;

      return new Date(fromTime.getTime() + amount * multiplier);
    }

    case 'cron': {
      try {
        const interval = CronParser.parse(schedule.value, {
          currentDate: fromTime
        });
        return interval.next().toDate();
      } catch (error) {
        throw new Error(`Failed to parse cron expression: ${schedule.value}`);
      }
    }

    default:
      throw new Error(`Unknown schedule type: ${(schedule as any).type}`);
  }
}

/**
 * Describe cron expression in human-readable format
 * 
 * @param cronExpr Cron expression
 * @returns Human-readable description
 */
export function describeCron(cronExpr: string): string {
  const parts = cronExpr.split(/\s+/);
  
  if (parts.length < 5) {
    return cronExpr;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (cronExpr === '0 0 * * *') return 'Daily at midnight';
  if (cronExpr === '0 7 * * *') return 'Daily at 7:00 AM';
  if (cronExpr === '0 9 * * 1') return 'Every Monday at 9:00 AM';
  if (cronExpr === '0 0 * * 0') return 'Every Sunday at midnight';
  if (cronExpr === '*/5 * * * *') return 'Every 5 minutes';
  if (cronExpr === '0 */2 * * *') return 'Every 2 hours';
  if (cronExpr === '0 0 1 * *') return 'First day of every month at midnight';

  // Generic description
  const desc: string[] = [];

  if (minute === '*') {
    desc.push('every minute');
  } else if (minute.startsWith('*/')) {
    desc.push(`every ${minute.substring(2)} minutes`);
  } else {
    desc.push(`at minute ${minute}`);
  }

  if (hour !== '*') {
    if (hour.startsWith('*/')) {
      desc.push(`every ${hour.substring(2)} hours`);
    } else {
      desc.push(`at hour ${hour}`);
    }
  }

  if (dayOfMonth !== '*') {
    desc.push(`on day ${dayOfMonth}`);
  }

  if (month !== '*') {
    desc.push(`in month ${month}`);
  }

  if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dayOfWeek);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      desc.push(`on ${days[dayNum]}`);
    }
  }

  return desc.join(', ');
}

/**
 * Validate schedule format
 * 
 * @param scheduleStr Schedule string to validate
 * @returns True if valid, false otherwise
 */
export function isValidSchedule(scheduleStr: string): boolean {
  try {
    parse(scheduleStr);
    return true;
  } catch {
    return false;
  }
}
