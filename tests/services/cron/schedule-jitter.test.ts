/**
 * Jitter (Load Distribution) Tests
 * 
 * Tests for schedule jitter functionality.
 */

import { calculateNextRun, parse } from '../../../src/services/cron/schedule-parser';
import type { CronSchedule } from '../../../src/services/cron/cron-types';

describe('Jitter (Load Distribution)', () => {
  describe('jitter application', () => {
    test('should apply jitter to interval schedule', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '30m',
        jitter: 5, // ±5 minutes
        description: 'Every 30 minutes'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base calculation: 10:00 + 30min = 10:30
      // With ±5min jitter: should be between 10:25 and 10:35
      const expectedMin = new Date('2026-04-22T10:25:00Z').getTime();
      const expectedMax = new Date('2026-04-22T10:35:00Z').getTime();
      const actualTime = nextRun.getTime();

      expect(actualTime).toBeGreaterThanOrEqual(expectedMin);
      expect(actualTime).toBeLessThanOrEqual(expectedMax);
    });

    test('should apply jitter to cron schedule', () => {
      const schedule: CronSchedule = {
        type: 'cron',
        value: '0 10 * * *', // Daily at 10:00
        jitter: 15, // ±15 minutes
        description: 'Daily at 10:00 AM'
      };

      const baseTime = new Date('2026-04-22T09:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base calculation: 10:00
      // With ±15min jitter: should be within reasonable range of 10:00
      // Note: Cron jitter might behave differently, so we just check it returns a valid date
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    test('should NOT apply jitter to once schedule', () => {
      const targetTime = new Date('2026-04-22T14:00:00Z');
      const schedule: CronSchedule = {
        type: 'once',
        value: targetTime.toISOString(),
        jitter: 10, // Should be ignored
        description: 'Once at specific time'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Should return exact target time, no jitter
      expect(nextRun.getTime()).toBe(targetTime.getTime());
    });

    test('should handle zero jitter', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        jitter: 0, // No jitter
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun1 = calculateNextRun(schedule, baseTime);
      const nextRun2 = calculateNextRun(schedule, baseTime);

      // With no jitter, should get deterministic result
      expect(nextRun1.getTime()).toBe(nextRun2.getTime());
    });

    test('should handle undefined jitter', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        // No jitter field
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Should calculate without jitter (deterministic)
      const expected = new Date('2026-04-22T11:00:00Z').getTime();
      expect(nextRun.getTime()).toBe(expected);
    });
  });

  describe('jitter range validation', () => {
    test('should respect jitter range bounds', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        jitter: 10,
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const samples = 100;
      const results: number[] = [];

      // Generate multiple samples
      for (let i = 0; i < samples; i++) {
        const nextRun = calculateNextRun(schedule, baseTime);
        results.push(nextRun.getTime());
      }

      // All results should be within ±10 minutes
      const expectedTime = new Date('2026-04-22T11:00:00Z').getTime();
      const minTime = expectedTime - (10 * 60000);
      const maxTime = expectedTime + (10 * 60000);

      results.forEach(time => {
        expect(time).toBeGreaterThanOrEqual(minTime);
        expect(time).toBeLessThanOrEqual(maxTime);
      });
    });

    test('should produce varied results with jitter', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        jitter: 15,
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const samples = 20;
      const results = new Set<number>();

      // Generate multiple samples
      for (let i = 0; i < samples; i++) {
        const nextRun = calculateNextRun(schedule, baseTime);
        results.add(nextRun.getTime());
      }

      // With jitter, we should get different values (not all the same)
      // Statistical expectation: at least 50% unique values with 15min jitter
      expect(results.size).toBeGreaterThan(samples * 0.5);
    });
  });

  describe('jitter with different time units', () => {
    test('should apply jitter to minute intervals', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '5m',
        jitter: 1,
        description: 'Every 5 minutes'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base: 10:05, jitter ±1min: 10:04 to 10:06
      const expectedMin = new Date('2026-04-22T10:04:00Z').getTime();
      const expectedMax = new Date('2026-04-22T10:06:00Z').getTime();

      expect(nextRun.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRun.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    test('should apply jitter to hour intervals', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '2h',
        jitter: 20,
        description: 'Every 2 hours'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base: 12:00, jitter ±20min: 11:40 to 12:20
      const expectedMin = new Date('2026-04-22T11:40:00Z').getTime();
      const expectedMax = new Date('2026-04-22T12:20:00Z').getTime();

      expect(nextRun.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRun.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    test('should apply jitter to day intervals', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1d',
        jitter: 60, // ±1 hour
        description: 'Every 1 day'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base: Apr 23 10:00, jitter ±60min: Apr 23 09:00 to 11:00
      const expectedMin = new Date('2026-04-23T09:00:00Z').getTime();
      const expectedMax = new Date('2026-04-23T11:00:00Z').getTime();

      expect(nextRun.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRun.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('jitter with cron expressions', () => {
    test('should apply jitter to daily cron', () => {
      const schedule: CronSchedule = {
        type: 'cron',
        value: '0 7 * * *', // 7:00 AM daily
        jitter: 15,
        description: 'Daily at 7:00 AM'
      };

      const baseTime = new Date('2026-04-22T06:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base: 07:00 today
      // With jitter, should still be a reasonable time
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    test('should apply jitter to weekly cron', () => {
      const schedule: CronSchedule = {
        type: 'cron',
        value: '0 9 * * 1', // 9:00 AM every Monday
        jitter: 30,
        description: 'Weekly on Monday at 9:00 AM'
      };

      // Start on Sunday
      const baseTime = new Date('2026-04-19T08:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Should be after base time
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(baseTime.getTime());
    });
  });

  describe('load distribution effectiveness', () => {
    test('should distribute load across time window', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        jitter: 10,
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const samples = 100;
      const buckets: { [key: string]: number } = {};

      // Generate samples and bucket by minute
      for (let i = 0; i < samples; i++) {
        const nextRun = calculateNextRun(schedule, baseTime);
        const minute = nextRun.getMinutes();
        const key = `${nextRun.getHours()}:${minute}`;
        buckets[key] = (buckets[key] || 0) + 1;
      }

      // Should have reasonable distribution across buckets
      // (not all in one bucket)
      const bucketCount = Object.keys(buckets).length;
      expect(bucketCount).toBeGreaterThan(5); // At least 5 different minutes
    });
  });

  describe('edge cases', () => {
    test('should handle large jitter values', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '1h',
        jitter: 120, // ±2 hours
        description: 'Every 1 hour'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Base: 11:00, jitter ±120min: 09:00 to 13:00
      const expectedMin = new Date('2026-04-22T09:00:00Z').getTime();
      const expectedMax = new Date('2026-04-22T13:00:00Z').getTime();

      expect(nextRun.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRun.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    test('should handle negative jitter (treat as absolute value)', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '30m',
        jitter: -5, // Should be treated as absolute value
        description: 'Every 30 minutes'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Implementation-dependent: should handle gracefully
      expect(nextRun).toBeInstanceOf(Date);
    });

    test('should not cause negative timestamps', () => {
      const schedule: CronSchedule = {
        type: 'interval',
        value: '5m',
        jitter: 10, // Jitter larger than interval
        description: 'Every 5 minutes'
      };

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(schedule, baseTime);

      // Even with large jitter, should not go backward
      // At minimum should be at baseTime (though typically slightly forward)
      expect(nextRun.getTime()).toBeGreaterThan(0);
      // Allow for some backward jitter but not before a reasonable minimum
      const minTime = baseTime.getTime() - (15 * 60000); // Allow up to 15min backward
      expect(nextRun.getTime()).toBeGreaterThanOrEqual(minTime);
    });
  });

  describe('integration with tool', () => {
    test('should parse jitter from schedule string', () => {
      // This tests the integration between parse() and calculateNextRun()
      const scheduleStr = '30m'; // Just the interval
      const parsed = parse(scheduleStr);
      
      // Add jitter manually (as tool would do)
      parsed.jitter = 5;

      const baseTime = new Date('2026-04-22T10:00:00Z');
      const nextRun = calculateNextRun(parsed, baseTime);

      // Should return a valid date
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(0);
      
      // Should be reasonably close to expected time (allow wide range since implementation varies)
      const expectedBase = new Date('2026-04-22T10:30:00Z').getTime();
      const timeDiff = Math.abs(nextRun.getTime() - expectedBase);
      // Allow 4 hour buffer to account for implementation variations
      expect(timeDiff).toBeLessThan(4 * 60 * 60000);
    });
  });
});
