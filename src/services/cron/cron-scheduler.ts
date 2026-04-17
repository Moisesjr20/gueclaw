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

  private constructor() {
    this.storage = CronStorage.getInstance();
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
    console.log('[CronScheduler] Initialized with dependencies');
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

    this.isRunning = false;
    console.log('[CronScheduler] Stopped');
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
   */
  private async executeJob(job: CronJob): Promise<void> {
    const startTime = Date.now();

    try {
      if (!this.agentController) {
        throw new Error('AgentController not initialized');
      }

      console.log(`[CronScheduler] Executing job "${job.name}" (${job.id})`);

      // Execute prompt via AgentController
      const result = await this.agentController.processDirectMessage(job.prompt, job.userId);

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
        tokens: result.tokensUsed
      };

      // Save output to file
      this.storage.saveOutput(output);

      // Deliver output (unless silent)
      if (!isSilent) {
        await this.deliverOutput(job, output);
      } else {
        console.log(`[CronScheduler] Job "${job.name}" marked [SILENT] - output not delivered`);
      }

      // Update job state
      await this.updateJobAfterExecution(job, true);

      console.log(`[CronScheduler] Job "${job.name}" completed successfully (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`[CronScheduler] Job "${job.name}" failed:`, error);

      // Create error output
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: false,
        output: '',
        error: error.message || String(error),
        duration,
        timestamp: new Date().toISOString()
      };

      // Save error output
      this.storage.saveOutput(output);

      // Deliver error (unless silent)
      if (!job.prompt.includes('[SILENT]')) {
        await this.deliverOutput(job, output);
      }

      // Update job state
      await this.updateJobAfterExecution(job, false);
    }
  }

  /**
   * Deliver job output to target
   */
  private async deliverOutput(job: CronJob, output: CronJobOutput): Promise<void> {
    try {
      switch (job.deliver) {
        case 'telegram': {
          if (!this.telegramBot) {
            console.error('[CronScheduler] Telegram bot not initialized');
            return;
          }

          const chatId = job.deliverTo || job.userId;
          if (!chatId) {
            console.error('[CronScheduler] No chat ID specified for Telegram delivery');
            return;
          }

          const message = output.success
            ? `🤖 **Cron Job: ${job.name}**\n\n${output.output}\n\n_Executed in ${output.duration}ms_`
            : `❌ **Cron Job Failed: ${job.name}**\n\n${output.error}\n\n_Execution time: ${output.duration}ms_`;

          await this.telegramBot.api.sendMessage(chatId, message, {
            parse_mode: 'Markdown'
          });

          console.log(`[CronScheduler] Delivered output to Telegram (chat: ${chatId})`);
          break;
        }

        case 'local': {
          // Output already saved to file by saveOutput()
          console.log('[CronScheduler] Output saved to local file');
          break;
        }

        case 'none': {
          // No delivery
          console.log('[CronScheduler] No delivery configured');
          break;
        }

        default:
          console.warn(`[CronScheduler] Unknown delivery target: ${job.deliver}`);
      }
    } catch (error) {
      console.error('[CronScheduler] Failed to deliver output:', error);
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
  public async triggerJob(jobId: string): Promise<void> {
    const job = this.storage.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'active') {
      throw new Error(`Job is not active: ${job.status}`);
    }

    console.log(`[CronScheduler] Manually triggering job "${job.name}"`);
    await this.executeJob(job);
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
