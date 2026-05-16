/**
 * Cron Jobs API - List & Create
 * 
 * GET  /api/cron/jobs - List all jobs with filters
 * POST /api/cron/jobs - Create new job
 */

import { NextRequest, NextResponse } from 'next/server';
import { CronStorage } from '@/../../src/services/cron/cron-storage';
import { CronScheduler } from '@/../../src/services/cron/cron-scheduler';
import { parse, calculateNextRun, isValidSchedule } from '@/../../src/services/cron/schedule-parser';
import { ConditionEvaluator } from '@/../../src/services/cron/condition-evaluator';
import { WebhookTriggerManager } from '@/../../src/services/cron/triggers/webhook-trigger-manager';
import type { DeliveryTarget } from '@/../../src/services/cron/cron-types';

/**
 * GET /api/cron/jobs
 * 
 * Query params:
 * - tags: string[] (comma-separated)
 * - group: string
 * - status: 'active' | 'paused' | 'disabled'
 * - search: string (search in name)
 */
export async function GET(req: NextRequest) {
  try {
    const storage = CronStorage.getInstance();
    const searchParams = req.nextUrl.searchParams;

    // Parse filters
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',') : undefined;
    const group = searchParams.get('group') || undefined;
    const status = searchParams.get('status') as 'active' | 'paused' | 'disabled' | undefined;
    const search = searchParams.get('search') || undefined;

    // Get jobs
    let jobs = storage.loadJobs();

    // Apply filters
    if (tags || group || status) {
      jobs = storage.findJobs({ tags, group, status });
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      jobs = jobs.filter(job => 
        job.name.toLowerCase().includes(searchLower) ||
        job.prompt.toLowerCase().includes(searchLower)
      );
    }

    // Sort by status (active first) then by name
    jobs.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'active') return -1;
        if (b.status === 'active') return 1;
        if (a.status === 'paused') return -1;
        if (b.status === 'paused') return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length
    });

  } catch (error: any) {
    console.error('[CronAPI] GET /jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/jobs
 * 
 * Body: {
 *   name: string
 *   prompt: string
 *   triggerType: 'time' | 'file' | 'webhook'
 *   schedule?: string (for time)
 *   jitter?: number
 *   filePath?: string (for file)
 *   fileEvent?: 'created' | 'modified' | 'deleted' | 'all'
 *   webhookRateLimit?: number (for webhook)
 *   deliver: DeliveryTarget
 *   deliverTo?: string
 *   tags?: string[]
 *   group?: string
 *   maxRetries?: number
 *   retryBackoffMs?: number
 *   timeoutSeconds?: number
 *   condition?: string
 *   userId: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const storage = CronStorage.getInstance();
    const scheduler = CronScheduler.getInstance();
    const body = await req.json();

    const {
      name,
      prompt,
      triggerType = 'time',
      schedule,
      jitter,
      filePath,
      fileEvent = 'all',
      webhookRateLimit,
      webhookIpWhitelist,
      webhookAllowedMethods,
      deliver = 'telegram',
      deliverTo,
      tags,
      group,
      maxRetries = 0,
      retryBackoffMs = 60000,
      timeoutSeconds = 300,
      condition,
      userId
    } = body;

    // Validate required fields
    if (!name || !prompt || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, prompt, userId' },
        { status: 400 }
      );
    }

    // Handle different trigger types
    if (triggerType === 'time') {
      if (!schedule) {
        return NextResponse.json(
          { error: 'Schedule is required for time-based triggers' },
          { status: 400 }
        );
      }

      if (!isValidSchedule(schedule)) {
        return NextResponse.json(
          { error: `Invalid schedule format: ${schedule}` },
          { status: 400 }
        );
      }

      const parsedSchedule = { ...parse(schedule), ...(jitter ? { jitter } : {}) };
      const nextRun = calculateNextRun(parsedSchedule);

      // Extract dependencies from condition if provided
      let dependencies: string[] | undefined;
      if (condition) {
        const evaluator = new ConditionEvaluator();
        dependencies = evaluator.extractDependencies(condition);
      }

      const job = await storage.createJob({
        name,
        prompt,
        schedule: parsedSchedule,
        trigger: { type: 'time', schedule: parsedSchedule },
        deliver: deliver as DeliveryTarget,
        deliverTo,
        status: 'active',
        nextRun: nextRun.toISOString(),
        userId,
        maxRetries,
        retryBackoffMs,
        timeoutSeconds,
        tags,
        group,
        condition,
        dependencies
      });

      return NextResponse.json({
        success: true,
        job,
        message: `Time-based job "${name}" created successfully`
      }, { status: 201 });

    } else if (triggerType === 'file') {
      if (!filePath) {
        return NextResponse.json(
          { error: 'filePath is required for file-based triggers' },
          { status: 400 }
        );
      }

      const job = await storage.createJob({
        name,
        prompt,
        schedule: { type: 'once', value: new Date().toISOString() },
        trigger: {
          type: 'file',
          fileWatch: {
            path: filePath,
            event: fileEvent,
            debounceMs: 5000,
            ignoreInitial: true
          }
        },
        deliver: deliver as DeliveryTarget,
        deliverTo,
        status: 'active',
        userId,
        maxRetries,
        retryBackoffMs,
        timeoutSeconds,
        tags,
        group
      });

      scheduler.registerJobFileWatcher(job.id);

      return NextResponse.json({
        success: true,
        job,
        message: `File-triggered job "${name}" created successfully`
      }, { status: 201 });

    } else if (triggerType === 'webhook') {
      const webhookManager = WebhookTriggerManager.getInstance();

      const webhookId = webhookManager.generateWebhookId();
      const secret = webhookManager.generateSecret();

      const job = await storage.createJob({
        name,
        prompt,
        schedule: { type: 'once', value: new Date().toISOString() },
        trigger: {
          type: 'webhook',
          webhook: {
            webhookId,
            secret,
            rateLimit: webhookRateLimit || 10,
            ipWhitelist: webhookIpWhitelist,
            allowedMethods: webhookAllowedMethods || ['POST']
          }
        },
        deliver: deliver as DeliveryTarget,
        deliverTo,
        status: 'active',
        userId,
        maxRetries,
        retryBackoffMs,
        timeoutSeconds,
        tags,
        group
      });

      scheduler.registerJobWebhook(job.id);

      const baseUrl = process.env.DASHBOARD_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const webhookUrl = `${baseUrl}/api/webhook/trigger/${webhookId}`;

      return NextResponse.json({
        success: true,
        job,
        webhookId,
        secret,
        webhookUrl,
        message: `Webhook-triggered job "${name}" created successfully`
      }, { status: 201 });

    } else {
      return NextResponse.json(
        { error: `Unknown trigger type: ${triggerType}` },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('[CronAPI] POST /jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to create job', message: error.message },
      { status: 500 }
    );
  }
}
