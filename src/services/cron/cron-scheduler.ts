/**
 * Cron Scheduler
 * 
 * Core scheduling engine that executes jobs based on their schedules.
 */

import type { Bot } from 'grammy';
import type { CronJob, CronJobOutput } from './cron-types';
import { CronStorage } from './cron-storage';
import { calculateNextRun } from './schedule-parser';
import { AgentController } from '../../core/agent-controller';
import { DeliveryRouter } from './delivery/delivery-router';
import { FileTriggerManager } from './triggers/file-trigger-manager';
import { WebhookTriggerManager } from './triggers/webhook-trigger-manager';
import { ConditionEvaluator } from './condition-evaluator';

/**
 * Cron Scheduler - Singleton
 */
export class CronScheduler {
  private static instance: CronScheduler;
  private storage: CronStorage;
  private tickInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private agentController: AgentController | null = null;
  private telegramBot: Bot | null = null;
  private deliveryRouter: DeliveryRouter | null = null;
  private fileTriggerManager: FileTriggerManager;
  private webhookTriggerManager: WebhookTriggerManager;
  private conditionEvaluator: ConditionEvaluator;

  private constructor() {
    this.storage = CronStorage.getInstance();
    this.fileTriggerManager = new FileTriggerManager();
    this.webhookTriggerManager = WebhookTriggerManager.getInstance();
    this.conditionEvaluator = new ConditionEvaluator();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  /**
   * Initialize with required dependencies
   */
  public initialize(agentController: AgentController, telegramBot: Bot): void {
    this.agentController = agentController;
    this.telegramBot = telegramBot;
    this.deliveryRouter = new DeliveryRouter(telegramBot);
    console.log('[CronScheduler] Initialized with dependencies');
  }

  /**
   * Recover missed tasks from downtime
   * 
   * Looks for jobs that should have executed while the system was offline
   * and executes them once with recovery metadata.
   */
  public async recoverMissedTasks(): Promise<void> {
    const jobs = this.storage.loadJobs();
    const now = new Date();
    const missed: CronJob[] = [];
    
    // Recovery window: 24 hours (configurable via env)
    const recoveryWindowHours = parseInt(process.env.CRON_RECOVERY_WINDOW_HOURS || '24', 10);
    const recoveryWindowMs = recoveryWindowHours * 60 * 60 * 1000;
    
    for (const job of jobs) {
      if (job.status !== 'active') continue;
      if (!job.nextRun) continue;
      
      const nextRun = new Date(job.nextRun);
      const timeSinceScheduled = now.getTime() - nextRun.getTime();
      
      // Job should have run in the last N hours
      if (timeSinceScheduled > 0 && timeSinceScheduled < recoveryWindowMs) {
        // One-shot jobs: always recover
        // Recurring jobs: only if lastRun < nextRun (hasn't executed yet)
        if (job.schedule.type === 'once' || !job.lastRun || new Date(job.lastRun) < nextRun) {
          missed.push(job);
        }
      }
    }
    
    if (missed.length > 0) {
      console.log(`[CronScheduler] 🔄 Recovering ${missed.length} missed task(s)`);
      
      for (const job of missed) {
        const scheduledTime = new Date(job.nextRun!);
        const delayMinutes = Math.round((now.getTime() - scheduledTime.getTime()) / 60000);
        console.log(`  - ${job.name} (scheduled: ${job.nextRun}, delayed by ${delayMinutes}min)`);
        
        await this.executeJob(job, true);
      }
      
      console.log('[CronScheduler] ✅ Missed task recovery completed');
    } else {
      console.log('[CronScheduler] No missed tasks to recover');
    }
  }

  /**
   * Start the scheduler (60s tick loop)
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[CronScheduler] Already running');
      return;
    }

    this.storage.ensureDirs();
    this.isRunning = true;

    // Recover missed tasks before starting tick loop
    const recoveryEnabled = process.env.CRON_RECOVERY_ENABLED !== 'false';
    if (recoveryEnabled) {
      this.recoverMissedTasks().catch(err => {
        console.error('[CronScheduler] Missed task recovery failed:', err);
      });
    }

    // Register file watchers for file-triggered jobs
    this.registerFileWatchers();

    // Register webhooks for webhook-triggered jobs
    this.registerWebhooks();

    // Initial tick
    this.tick();

    // Set up 60s interval
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 60000); // 60 seconds

    console.log('[CronScheduler] Started (60s tick interval)');
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[CronScheduler] Not running');
      return;
    }

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Cleanup file watchers
    this.fileTriggerManager.cleanup();

    this.isRunning = false;
    console.log('[CronScheduler] Stopped');
  }

  /**
   * Register file watchers for all file-triggered jobs
   */
  private registerFileWatchers(): void {
    const jobs = this.storage.loadJobs();
    let watcherCount = 0;

    for (const job of jobs) {
      if (job.status !== 'active') continue;
      
      // Check if job has file trigger
      if (job.trigger?.type === 'file' && job.trigger.fileWatch) {
        const config = job.trigger.fileWatch;

        this.fileTriggerManager.registerFileWatch(
          job.id,
          config,
          (eventType, filePath) => {
            this.handleFileTrigger(job, eventType, filePath);
          }
        );

        watcherCount++;
      }
    }

    if (watcherCount > 0) {
      console.log(`[CronScheduler] ✅ Registered ${watcherCount} file watcher(s)`);
    }
  }

  /**
   * Register all webhook triggers on startup
   */
  private registerWebhooks(): void {
    const jobs = this.storage.loadJobs();
    let webhookCount = 0;

    for (const job of jobs) {
      if (job.status !== 'active') continue;
      
      // Check if job has webhook trigger
      if (job.trigger?.type === 'webhook' && job.trigger.webhook) {
        this.webhookTriggerManager.registerWebhook(job.id, job.trigger.webhook);
        webhookCount++;
      }
    }

    if (webhookCount > 0) {
      console.log(`[CronScheduler] ✅ Registered ${webhookCount} webhook(s)`);
    }
  }

  /**
   * Register file watcher for a specific job (called when job is created dynamically)
   */
  public registerJobFileWatcher(jobId: string): void {
    const job = this.storage.getJob(jobId);
    
    if (!job) {
      console.error(`[CronScheduler] Job ${jobId} not found`);
      return;
    }

    if (job.status !== 'active') {
      console.log(`[CronScheduler] Job ${jobId} is not active, skipping watcher registration`);
      return;
    }

    if (job.trigger?.type === 'file' && job.trigger.fileWatch) {
      this.fileTriggerManager.registerFileWatch(
        job.id,
        job.trigger.fileWatch,
        (eventType, filePath) => {
          this.handleFileTrigger(job, eventType, filePath);
        }
      );

      console.log(`[CronScheduler] ✅ Registered file watcher for job ${jobId}`);
    }
  }

  /**
   * Register webhook for a job
   */
  public registerJobWebhook(jobId: string): void {
    const job = this.storage.getJob(jobId);
    
    if (!job) {
      console.error(`[CronScheduler] Job ${jobId} not found`);
      return;
    }

    if (job.status !== 'active') {
      console.log(`[CronScheduler] Job ${jobId} is not active, skipping webhook registration`);
      return;
    }

    if (job.trigger?.type === 'webhook' && job.trigger.webhook) {
      this.webhookTriggerManager.registerWebhook(job.id, job.trigger.webhook);
      console.log(`[CronScheduler] ✅ Registered webhook ${job.trigger.webhook.webhookId} for job ${jobId}`);
    }
  }

  /**
   * Unregister webhook for a job
   */
  public unregisterJobWebhook(jobId: string): void {
    const job = this.storage.getJob(jobId);
    
    if (!job || job.trigger?.type !== 'webhook' || !job.trigger.webhook) {
      return;
    }

    this.webhookTriggerManager.unregisterWebhook(job.trigger.webhook.webhookId);
    console.log(`[CronScheduler] 🗑️ Unregistered webhook ${job.trigger.webhook.webhookId} for job ${jobId}`);
  }

  /**
   * Handle file trigger event
   */
  private async handleFileTrigger(
    job: CronJob,
    eventType: string,
    filePath: string
  ): Promise<void> {
    console.log(
      `[CronScheduler] File trigger for job "${job.name}": ${eventType} on ${filePath}`
    );

    // Update job prompt with file context
    const enrichedPrompt = `${job.prompt}\n\n[File ${eventType}: ${filePath}]`;

    // Create temporary job with enriched prompt
    const tempJob: CronJob = {
      ...job,
      prompt: enrichedPrompt
    };

    // Execute job
    await this.executeJob(tempJob, false);
  }

  /**
   * Main tick function - checks for due jobs
   */
  private async tick(): Promise<void> {
    try {
      const jobs = this.storage.loadJobs();
      const now = new Date();

      console.log(`[CronScheduler] Tick at ${now.toISOString()} - checking ${jobs.length} jobs`);

      for (const job of jobs) {
        // Skip inactive jobs
        if (job.status !== 'active') {
          continue;
        }

        // Skip file-triggered jobs (handled by file watcher)
        if (job.trigger?.type === 'file') {
          continue;
        }

        // Skip webhook-triggered jobs (handled by HTTP endpoint)
        if (job.trigger?.type === 'webhook') {
          continue;
        }

        // Check conditional execution
        if (job.condition) {
          const conditionPassed = await this.conditionEvaluator.evaluate(job.condition, job.id);
          
          if (!conditionPassed) {
            console.log(
              `[CronScheduler] ⏭️ Job "${job.name}" skipped - condition not met: ${job.condition}`
            );
            
            // Still update nextRun for recurring jobs
            if (job.schedule.type !== 'once') {
              const nextRun = calculateNextRun(job.schedule);
              await this.storage.updateJob(job.id, {
                nextRun: nextRun.toISOString()
              });
            }
            
            continue;
          }
          
          console.log(
            `[CronScheduler] ✅ Job "${job.name}" condition passed: ${job.condition}`
          );
        }

        // Check if job is due
        if (job.nextRun && new Date(job.nextRun) <= now) {
          console.log(`[CronScheduler] Job "${job.name}" is due - executing`);
          await this.executeJob(job);
        }
      }

      // Clean old outputs periodically (every 100 ticks = ~100 minutes)
      if (Math.random() < 0.01) {
        this.storage.cleanOldOutputs(5);
      }
    } catch (error) {
      console.error('[CronScheduler] Tick error:', error);
    }
  }

  /**
   * Execute a single job
   * 
   * @param job Job to execute
   * @param isRecovery Whether this is a recovery execution (missed task)
   */
  private async executeJob(job: CronJob, isRecovery: boolean = false, context?: Record<string, any>): Promise<void> {
    const startTime = Date.now();
    const timeout = (job.timeoutSeconds || 300) * 1000; // Default: 5 minutes

    try {
      if (!this.agentController) {
        throw new Error('AgentController not initialized');
      }

      if (isRecovery) {
        console.log(`[CronScheduler] 🔄 Executing recovered job "${job.name}" (${job.id})`);
      } else if (context) {
        console.log(`[CronScheduler] Executing job "${job.name}" (${job.id}) with context`);
      } else {
        console.log(`[CronScheduler] Executing job "${job.name}" (${job.id})`);
      }

      // Enrich prompt with context if provided
      let enrichedPrompt = job.prompt;
      if (context) {
        enrichedPrompt = `${job.prompt}\n\n---\n**Context:**\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
      }

      // Execute prompt via AgentController with timeout protection
      const result = await Promise.race([
        this.agentController.processDirectMessage(enrichedPrompt, job.userId),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Job execution timeout')), timeout)
        )
      ]);

      const duration = Date.now() - startTime;

      // Check for [SILENT] marker
      const isSilent = result.response.includes('[SILENT]');
      const cleanedOutput = result.response.replace(/\[SILENT\]/g, '').trim();

      // Create output record
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: true,
        output: cleanedOutput,
        duration,
        timestamp: new Date().toISOString(),
        toolsUsed: result.toolCalls?.map((tc: any) => tc.toolName),
        tokens: result.tokensUsed,
        recovered: isRecovery,
        originalScheduledTime: isRecovery ? job.nextRun : undefined
      };

      // Save output to file
      this.storage.saveOutput(output);

      // Deliver output (unless silent)
      if (!isSilent) {
        await this.deliverOutput(job, output);
      } else {
        console.log(`[CronScheduler] Job "${job.name}" marked [SILENT] - output not delivered`);
      }

      // Reset retry counter on success
      if (job.retryCount && job.retryCount > 0) {
        await this.storage.updateJob(job.id, { retryCount: 0 });
      }

      // Update job state
      await this.updateJobAfterExecution(job, true);

      if (isRecovery) {
        console.log(`[CronScheduler] ✅ Recovered job "${job.name}" completed successfully (${duration}ms)`);
      } else {
        console.log(`[CronScheduler] Job "${job.name}" completed successfully (${duration}ms)`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`[CronScheduler] Job "${job.name}" failed:`, error);

      // Retry logic
      const currentRetries = job.retryCount || 0;
      const maxRetries = job.maxRetries || 0;

      if (currentRetries < maxRetries) {
        // Schedule retry
        const backoffMs = job.retryBackoffMs || 60000; // Default: 1 minute
        const nextRetryTime = new Date(Date.now() + backoffMs);

        console.log(
          `[CronScheduler] 🔄 Scheduling retry ${currentRetries + 1}/${maxRetries} ` +
          `for job "${job.name}" at ${nextRetryTime.toISOString()}`
        );

        await this.storage.updateJob(job.id, {
          retryCount: currentRetries + 1,
          nextRun: nextRetryTime.toISOString()
        });

      } else {
        // Max retries reached - permanent failure
        if (maxRetries > 0) {
          console.error(
            `[CronScheduler] ❌ Job "${job.name}" failed permanently after ${maxRetries} retries`
          );
        }

        // Create error output
        const output: CronJobOutput = {
          jobId: job.id,
          jobName: job.name,
          success: false,
          output: '',
          error: maxRetries > 0 
            ? `Failed after ${maxRetries} retries: ${error.message}`
            : error.message || String(error),
          duration,
          timestamp: new Date().toISOString(),
          recovered: isRecovery,
          originalScheduledTime: isRecovery ? job.nextRun : undefined
        };

        // Save error output
        this.storage.saveOutput(output);

        // Deliver error (unless silent)
        if (!job.prompt.includes('[SILENT]')) {
          await this.deliverOutput(job, output);
        }

        // Reset retry counter for next scheduled execution
        if (job.retryCount && job.retryCount > 0) {
          await this.storage.updateJob(job.id, { retryCount: 0 });
        }

        // Update next run (for recurring jobs)
        await this.updateJobAfterExecution(job, false);
      }
    }
  }

  /**
   * Deliver job output to target
   */
  private async deliverOutput(job: CronJob, output: CronJobOutput): Promise<void> {
    if (!this.deliveryRouter) {
      console.error('[CronScheduler] DeliveryRouter not initialized');
      return;
    }

    try {
      await this.deliveryRouter.deliver(job, output);
    } catch (error) {
      console.error('[CronScheduler] Failed to deliver output:', error);
      // Don't throw - delivery failure shouldn't prevent job from being marked as executed
    }
  }

  /**
   * Update job state after execution
   */
  private async updateJobAfterExecution(job: CronJob, success: boolean): Promise<void> {
    const updates: Partial<CronJob> = {
      lastRun: new Date().toISOString()
    };

    // Calculate next run based on schedule type
    if (job.schedule.type === 'once') {
      // Disable "once" jobs after execution
      updates.status = 'disabled';
      updates.nextRun = undefined;
      console.log(`[CronScheduler] Job "${job.name}" disabled (one-time execution)`);
    } else {
      // Calculate next run for recurring jobs
      try {
        const nextRun = calculateNextRun(job.schedule, new Date());
        updates.nextRun = nextRun.toISOString();
        console.log(`[CronScheduler] Job "${job.name}" next run: ${nextRun.toISOString()}`);
      } catch (error) {
        console.error(`[CronScheduler] Failed to calculate next run for "${job.name}":`, error);
        updates.status = 'paused';
      }
    }

    // Update in storage
    await this.storage.updateJob(job.id, updates);
  }

  /**
   * Manually trigger a job execution
   */
  public async triggerJob(jobId: string, context?: Record<string, any>): Promise<void> {
    const job = this.storage.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'active') {
      throw new Error(`Job is not active: ${job.status}`);
    }

    console.log(`[CronScheduler] Manually triggering job "${job.name}"${context ? ' with context' : ''}`);
    await this.executeJob(job, false, context);
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    running: boolean;
    jobCount: number;
    activeJobs: number;
    nextDueJob: { name: string; dueAt: string } | null;
  } {
    const jobs = this.storage.loadJobs();
    const activeJobs = jobs.filter(j => j.status === 'active');

    // Find next due job
    let nextDueJob: { name: string; dueAt: string } | null = null;
    if (activeJobs.length > 0) {
      const sorted = activeJobs
        .filter(j => j.nextRun)
        .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime());

      if (sorted.length > 0) {
        nextDueJob = {
          name: sorted[0].name,
          dueAt: sorted[0].nextRun!
        };
      }
    }

    return {
      running: this.isRunning,
      jobCount: jobs.length,
      activeJobs: activeJobs.length,
      nextDueJob
    };
  }
}
