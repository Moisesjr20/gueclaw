/**
 * Cron Tool
 * 
 * LLM tool for managing scheduled jobs.
 */

import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { CronStorage } from '../services/cron/cron-storage';
import { CronScheduler } from '../services/cron/cron-scheduler';
import { parse, calculateNextRun, isValidSchedule } from '../services/cron/schedule-parser';
import type { DeliveryTarget } from '../services/cron/cron-types';

/**
 * Cron management tool
 */
export class CronTool extends BaseTool {
  public readonly name = 'cron';
  public readonly description = 'Manage scheduled jobs (create, list, delete, pause, resume, trigger). Use this to schedule recurring or one-time tasks.';

  private storage: CronStorage;
  private scheduler: CronScheduler;

  constructor() {
    super();
    this.storage = CronStorage.getInstance();
    this.scheduler = CronScheduler.getInstance();
  }

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'delete', 'pause', 'resume', 'trigger', 'status'],
            description: 'Action to perform'
          },
          name: {
            type: 'string',
            description: 'Job name (required for create)'
          },
          prompt: {
            type: 'string',
            description: 'Prompt to execute (required for create)'
          },
          schedule: {
            type: 'string',
            description: 'Schedule format: "30m", "2h", "1d", "every 30m", "0 7 * * *", "2026-04-17T14:00:00Z" (required for create)'
          },
          deliver: {
            type: 'string',
            enum: ['telegram', 'local', 'none'],
            description: 'Delivery target (default: telegram)'
          },
          deliverTo: {
            type: 'string',
            description: 'Delivery target ID (e.g., Telegram chat ID). Defaults to user ID.'
          },
          jobId: {
            type: 'string',
            description: 'Job ID (required for delete, pause, resume, trigger)'
          },
          userId: {
            type: 'string',
            description: 'User ID (required for create)'
          }
        },
        required: ['action']
      }
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    const { action, name, prompt, schedule, deliver, deliverTo, jobId, userId } = args;

    try {
      switch (action) {
        case 'create': {
          // Validate required fields
          if (!name || !prompt || !schedule || !userId) {
            return this.error('Missing required fields: name, prompt, schedule, userId');
          }

          // Validate schedule format
          if (!isValidSchedule(schedule)) {
            return this.error(
              `Invalid schedule format: ${schedule}. Use "30m", "2h", "every 1d", "0 7 * * *", or ISO timestamp.`
            );
          }

          // Parse schedule
          const parsedSchedule = parse(schedule);

          // Calculate first run
          const nextRun = calculateNextRun(parsedSchedule);

          // Create job
          const job = await this.storage.createJob({
            name,
            prompt,
            schedule: parsedSchedule,
            deliver: (deliver as DeliveryTarget) || 'telegram',
            deliverTo,
            status: 'active',
            nextRun: nextRun.toISOString(),
            userId
          });

          return this.success(
            `✅ Job "${name}" created successfully\n\n` +
            `**ID:** ${job.id}\n` +
            `**Schedule:** ${job.schedule.description || job.schedule.value}\n` +
            `**Next Run:** ${job.nextRun}\n` +
            `**Status:** ${job.status}`,
            { jobId: job.id }
          );
        }

        case 'list': {
          const jobs = userId ? this.storage.getJobsByUser(userId) : this.storage.loadJobs();

          if (jobs.length === 0) {
            return this.success('📋 No jobs found');
          }

          const jobList = jobs
            .map(j => 
              `**${j.name}** (${j.status})\n` +
              `• ID: \`${j.id}\`\n` +
              `• Schedule: ${j.schedule.description || j.schedule.value}\n` +
              `• Next Run: ${j.nextRun || 'N/A'}\n` +
              `• Deliver: ${j.deliver}`
            )
            .join('\n\n');

          return this.success(`📋 **Jobs (${jobs.length})**\n\n${jobList}`, {
            count: jobs.length
          });
        }

        case 'delete': {
          if (!jobId) {
            return this.error('Missing required field: jobId');
          }

          const deleted = await this.storage.deleteJob(jobId);

          if (!deleted) {
            return this.error(`Job not found: ${jobId}`);
          }

          return this.success(`✅ Job deleted successfully`);
        }

        case 'pause': {
          if (!jobId) {
            return this.error('Missing required field: jobId');
          }

          const job = this.storage.getJob(jobId);
          if (!job) {
            return this.error(`Job not found: ${jobId}`);
          }

          await this.storage.updateJob(jobId, { status: 'paused' });

          return this.success(`⏸️ Job "${job.name}" paused`);
        }

        case 'resume': {
          if (!jobId) {
            return this.error('Missing required field: jobId');
          }

          const job = this.storage.getJob(jobId);
          if (!job) {
            return this.error(`Job not found: ${jobId}`);
          }

          // Recalculate next run
          const nextRun = calculateNextRun(job.schedule, new Date());

          await this.storage.updateJob(jobId, {
            status: 'active',
            nextRun: nextRun.toISOString()
          });

          return this.success(
            `▶️ Job "${job.name}" resumed\n\n` +
            `**Next Run:** ${nextRun.toISOString()}`
          );
        }

        case 'trigger': {
          if (!jobId) {
            return this.error('Missing required field: jobId');
          }

          await this.scheduler.triggerJob(jobId);

          return this.success(`🚀 Job triggered successfully (executing in background)`);
        }

        case 'status': {
          const status = this.scheduler.getStatus();

          let message = `📊 **Cron Scheduler Status**\n\n` +
            `**Running:** ${status.running ? '✅ Yes' : '❌ No'}\n` +
            `**Total Jobs:** ${status.jobCount}\n` +
            `**Active Jobs:** ${status.activeJobs}\n`;

          if (status.nextDueJob) {
            message += `**Next Due:** ${status.nextDueJob.name} at ${status.nextDueJob.dueAt}`;
          }

          return this.success(message, { status });
        }

        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      return this.error(error.message || String(error));
    }
  }
}
