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
import { ConditionEvaluator } from '../services/cron/condition-evaluator';

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
            enum: ['create', 'list', 'delete', 'pause', 'resume', 'trigger', 'status', 'bulk-pause', 'bulk-resume', 'bulk-delete'],
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
            description: 'Schedule format: "30m", "2h", "1d", "every 30m", "0 7 * * *", "2026-04-17T14:00:00Z" (for time-based triggers)'
          },
          jitter: {
            type: 'number',
            description: 'Random time offset in minutes (±jitter). Distributes load when multiple jobs run at same time. Only for recurring jobs (interval/cron). Example: jitter=5 → executes between -5min and +5min of scheduled time.'
          },
          triggerType: {
            type: 'string',
            enum: ['time', 'file', 'webhook'],
            description: 'Trigger type: "time" (schedule-based), "file" (file system event-based), or "webhook" (HTTP webhook-based). Default: time'
          },
          filePath: {
            type: 'string',
            description: 'File path or glob pattern to watch (required when triggerType=file). Example: "data/logs/*.log" or "src/**/*.ts"'
          },
          fileEvent: {
            type: 'string',
            enum: ['created', 'modified', 'deleted', 'all'],
            description: 'File event to watch for (required when triggerType=file). Default: all'
          },
          fileDebounce: {
            type: 'number',
            description: 'Debounce time in milliseconds for file events (default: 5000)'
          },
          webhookRateLimit: {
            type: 'number',
            description: 'Rate limit for webhook (requests per minute, default: 10)'
          },
          webhookIpWhitelist: {
            type: 'array',
            items: { type: 'string' },
            description: 'IP whitelist for webhook (optional, empty = allow all)'
          },
          webhookAllowedMethods: {
            type: 'array',
            items: { type: 'string' },
            description: 'Allowed HTTP methods for webhook (default: [POST])'
          },
          deliver: {
            type: 'string',
            enum: ['telegram', 'whatsapp', 'email', 'webhook', 'discord', 'local', 'none'],
            description: 'Delivery target (default: telegram)'
          },
          deliverTo: {
            type: 'string',
            description: 'Delivery target ID (e.g., Telegram chat ID). Defaults to user ID.'
          },
          maxRetries: {
            type: 'number',
            description: 'Maximum retry attempts on failure (default: 0, no retry)'
          },
          retryBackoffMs: {
            type: 'number',
            description: 'Time between retries in milliseconds (default: 60000 = 1 minute)'
          },
          timeoutSeconds: {
            type: 'number',
            description: 'Execution timeout in seconds (default: 300 = 5 minutes)'
          },
          jobId: {
            type: 'string',
            description: 'Job ID (required for delete, pause, resume, trigger)'
          },
          userId: {
            type: 'string',
            description: 'User ID (required for create)'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization (e.g., ["backup", "critical", "daily"])'
          },
          group: {
            type: 'string',
            description: 'Group name for bulk operations (e.g., "maintenance", "monitoring")'
          },
          filterTags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (for list/bulk actions). Job must have ALL specified tags.'
          },
          filterGroup: {
            type: 'string',
            description: 'Filter by group (for list/bulk actions)'
          },
          filterStatus: {
            type: 'string',
            enum: ['active', 'paused', 'disabled'],
            description: 'Filter by status (for list action)'
          },
          condition: {
            type: 'string',
            description: 'Condition expression for conditional execution. Only runs job if condition passes. Examples: "job:abc123.success", "job:abc123.success AND job:xyz789.success", "job:abc123.lastRun < 2h". Supported: AND, OR, NOT, .success, .failed, .lastRun, age(), count()'
          }
        },
        required: ['action']
      }
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    const { action, name, prompt, schedule, deliver, deliverTo, jobId, userId, triggerType } = args;

    try {
      switch (action) {
        case 'create': {
          // Validate required fields
          if (!name || !prompt || !userId) {
            return this.error('Missing required fields: name, prompt, userId');
          }

          const trigger = triggerType || 'time';

          // Validate based on trigger type
          if (trigger === 'time') {
            if (!schedule) {
              return this.error('Schedule is required for time-based triggers');
            }

            if (!isValidSchedule(schedule)) {
              return this.error(
                `Invalid schedule format: ${schedule}. Use "30m", "2h", "every 1d", "0 7 * * *", or ISO timestamp.`
              );
            }

            // Parse schedule
            const parsedSchedule = parse(schedule);

            // Apply jitter if specified
            if (args.jitter && args.jitter > 0) {
              parsedSchedule.jitter = args.jitter;
            }

            // Calculate first run (jitter is applied inside calculateNextRun if configured)
            const nextRun = calculateNextRun(parsedSchedule);

            // Extract dependencies from condition if provided
            let dependencies: string[] | undefined;
            if (args.condition) {
              const evaluator = new ConditionEvaluator();
              dependencies = evaluator.extractDependencies(args.condition);
            }

            // Create time-based job
            const job = await this.storage.createJob({
              name,
              prompt,
              schedule: parsedSchedule,
              trigger: {
                type: 'time',
                schedule: parsedSchedule
              },
              deliver: (deliver as DeliveryTarget) || 'telegram',
              deliverTo,
              status: 'active',
              nextRun: nextRun.toISOString(),
              userId,
              maxRetries: args.maxRetries || 0,
              retryBackoffMs: args.retryBackoffMs || 60000,
              timeoutSeconds: args.timeoutSeconds || 300,
              tags: args.tags,
              group: args.group,
              condition: args.condition,
              dependencies
            });

            return this.success(
              `✅ Time-based job "${name}" created successfully\n\n` +
              `**ID:** ${job.id}\n` +
              `**Schedule:** ${job.schedule.description || job.schedule.value}\n` +
              (job.schedule.jitter ? `**Jitter:** ±${job.schedule.jitter} minutes\n` : '') +
              `**Next Run:** ${job.nextRun}\n` +
              `**Status:** ${job.status}\n` +
              `**Retry:** ${job.maxRetries} attempts (${job.retryBackoffMs}ms backoff)\n` +
              `**Timeout:** ${job.timeoutSeconds}s\n` +
              (job.condition ? `**Condition:** ${job.condition}\n` : '') +
              (job.dependencies && job.dependencies.length > 0 ? `**Dependencies:** ${job.dependencies.join(', ')}\n` : ''),
              { jobId: job.id }
            );

          } else if (trigger === 'file') {
            if (!args.filePath) {
              return this.error('filePath is required for file-based triggers');
            }

            // Create file-based job
            const job = await this.storage.createJob({
              name,
              prompt,
              schedule: { type: 'once', value: new Date().toISOString() }, // Dummy schedule for compatibility
              trigger: {
                type: 'file',
                fileWatch: {
                  path: args.filePath,
                  event: args.fileEvent || 'all',
                  debounceMs: args.fileDebounce || 5000,
                  ignoreInitial: true
                }
              },
              deliver: (deliver as DeliveryTarget) || 'telegram',
              deliverTo,
              status: 'active',
              userId,
              maxRetries: args.maxRetries || 0,
              retryBackoffMs: args.retryBackoffMs || 60000,
              timeoutSeconds: args.timeoutSeconds || 300,
              tags: args.tags,
              group: args.group
            });

            // Register file watcher immediately
            this.scheduler.registerJobFileWatcher(job.id);

            return this.success(
              `✅ File-triggered job "${name}" created successfully\n\n` +
              `**ID:** ${job.id}\n` +
              `**Watch Path:** ${args.filePath}\n` +
              `**Event:** ${args.fileEvent || 'all'}\n` +
              `**Debounce:** ${args.fileDebounce || 5000}ms\n` +
              `**Status:** ${job.status}\n` +
              `**Note:** File watcher is now active and monitoring`,
              { jobId: job.id }
            );

          } else if (trigger === 'webhook') {
            // Import WebhookTriggerManager here to avoid circular dependency
            const { WebhookTriggerManager } = require('../services/cron/triggers/webhook-trigger-manager');
            const webhookManager = WebhookTriggerManager.getInstance();

            // Generate webhook credentials
            const webhookId = webhookManager.generateWebhookId();
            const secret = webhookManager.generateSecret();

            // Create webhook-based job
            const job = await this.storage.createJob({
              name,
              prompt,
              schedule: { type: 'once', value: new Date().toISOString() }, // Dummy schedule for compatibility
              trigger: {
                type: 'webhook',
                webhook: {
                  webhookId,
                  secret,
                  rateLimit: args.webhookRateLimit || 10,
                  ipWhitelist: args.webhookIpWhitelist,
                  allowedMethods: args.webhookAllowedMethods || ['POST']
                }
              },
              deliver: (deliver as DeliveryTarget) || 'telegram',
              deliverTo,
              status: 'active',
              userId,
              maxRetries: args.maxRetries || 0,
              retryBackoffMs: args.retryBackoffMs || 60000,
              timeoutSeconds: args.timeoutSeconds || 300,
              tags: args.tags,
              group: args.group
            });

            // Register webhook immediately
            this.scheduler.registerJobWebhook(job.id);

            // Determine base URL (use dashboard URL or localhost)
            const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
            const webhookUrl = `${baseUrl}/api/webhook/trigger/${webhookId}`;

            return this.success(
              `✅ Webhook-triggered job "${name}" created successfully\n\n` +
              `**ID:** ${job.id}\n` +
              `**Webhook URL:** ${webhookUrl}\n` +
              `**Webhook ID:** ${webhookId}\n` +
              `**Secret:** ${secret}\n` +
              `**Rate Limit:** ${args.webhookRateLimit || 10} req/min\n` +
              `**Allowed Methods:** ${(args.webhookAllowedMethods || ['POST']).join(', ')}\n` +
              `**Status:** ${job.status}\n\n` +
              `**To trigger:**\n` +
              `\`\`\`bash\n` +
              `curl -X POST "${webhookUrl}" \\\\\n` +
              `  -H "X-Webhook-Signature: sha256=<signature>" \\\\\n` +
              `  -H "Content-Type: application/json" \\\\\n` +
              `  -d '{"key":"value"}'\n` +
              `\`\`\`\n\n` +
              `**Note:** Store the secret securely - it's needed to sign requests`,
              { jobId: job.id, webhookId, secret, webhookUrl }
            );

          } else {
            return this.error(`Unknown trigger type: ${trigger}`);
          }
        }

        case 'list': {
          let jobs = userId ? this.storage.getJobsByUser(userId) : this.storage.loadJobs();

          // Apply filters if provided
          if (args.filterTags || args.filterGroup || args.filterStatus) {
            jobs = this.storage.findJobs({
              tags: args.filterTags,
              group: args.filterGroup,
              status: args.filterStatus
            });
          }

          if (jobs.length === 0) {
            return this.success('📋 No jobs found');
          }

          const jobList = jobs
            .map(j => {
              let line = `**${j.name}** (${j.status})\n` +
                `• ID: \`${j.id}\`\n` +
                `• Schedule: ${j.schedule.description || j.schedule.value}\n` +
                `• Next Run: ${j.nextRun || 'N/A'}\n` +
                `• Deliver: ${j.deliver}`;
              
              if (j.tags && j.tags.length > 0) {
                line += `\n• Tags: ${j.tags.join(', ')}`;
              }
              
              if (j.group) {
                line += `\n• Group: ${j.group}`;
              }

              if (j.permanent) {
                line += `\n• 🔒 Permanent`;
              }

              return line;
            })
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

        case 'bulk-pause': {
          const filter = {
            tags: args.filterTags,
            group: args.filterGroup,
            createdBy: args.createdBy
          };

          const result = await this.storage.bulkPause(filter);

          if (result.count === 0) {
            return this.success('⏸️ No matching active jobs found to pause');
          }

          return this.success(
            `⏸️ **Bulk Pause Complete**\n\n` +
            `**Jobs Paused:** ${result.count}\n` +
            `**IDs:** ${result.jobs.slice(0, 10).map(id => `\`${id}\``).join(', ')}${result.jobs.length > 10 ? ` +${result.jobs.length - 10} more` : ''}`,
            { count: result.count, jobs: result.jobs }
          );
        }

        case 'bulk-resume': {
          const filter = {
            tags: args.filterTags,
            group: args.filterGroup,
            createdBy: args.createdBy
          };

          const result = await this.storage.bulkResume(filter);

          if (result.count === 0) {
            return this.success('▶️ No matching paused jobs found to resume');
          }

          return this.success(
            `▶️ **Bulk Resume Complete**\n\n` +
            `**Jobs Resumed:** ${result.count}\n` +
            `**IDs:** ${result.jobs.slice(0, 10).map(id => `\`${id}\``).join(', ')}${result.jobs.length > 10 ? ` +${result.jobs.length - 10} more` : ''}`,
            { count: result.count, jobs: result.jobs }
          );
        }

        case 'bulk-delete': {
          const filter = {
            tags: args.filterTags,
            group: args.filterGroup,
            createdBy: args.createdBy
          };

          const result = await this.storage.bulkDelete(filter);

          if (result.count === 0 && result.skipped === 0) {
            return this.success('🗑️ No matching jobs found to delete');
          }

          let message = `🗑️ **Bulk Delete Complete**\n\n` +
            `**Jobs Deleted:** ${result.count}\n`;

          if (result.skipped > 0) {
            message += `**Skipped (permanent):** ${result.skipped}\n`;
          }

          if (result.count > 0) {
            message += `**IDs:** ${result.jobs.slice(0, 10).map(id => `\`${id}\``).join(', ')}${result.jobs.length > 10 ? ` +${result.jobs.length - 10} more` : ''}`;
          }

          return this.success(message, {
            count: result.count,
            skipped: result.skipped,
            jobs: result.jobs
          });
        }

        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      return this.error(error.message || String(error));
    }
  }
}
