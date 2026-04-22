/**
 * Cron Scheduler Types
 * 
 * Defines interfaces for scheduled job execution system.
 */

/**
 * Schedule types supported by the cron system
 */
export type ScheduleType = 'once' | 'interval' | 'cron';

/**
 * Delivery targets for job outputs
 */
export type DeliveryTarget = 'telegram' | 'whatsapp' | 'email' | 'webhook' | 'discord' | 'local' | 'none';

/**
 * Job status
 */
export type JobStatus = 'active' | 'paused' | 'disabled';

/**
 * Schedule configuration
 * 
 * - once: Run once at specific timestamp
 * - interval: Run at regular intervals (e.g., "30m", "2h", "1d")
 * - cron: Run based on cron expression (e.g., "0 7 * * *")
 */
export interface CronSchedule {
  /**
   * Schedule type
   */
  type: ScheduleType;

  /**
   * Schedule value
   * - For 'once': ISO timestamp or "2m" (2 minutes from now)
   * - For 'interval': "30m", "2h", "1d"
   * - For 'cron': Standard cron expression
   */
  value: string;

  /**
   * Human-readable description of schedule
   */
  description?: string;

  /**
   * Jitter (random time offset) in minutes
   * 
   * Adds random variation ±jitter minutes to execution time.
   * Useful to distribute load when multiple jobs scheduled at same time.
   * 
   * Examples:
   * - jitter: 5 → executes between -5min and +5min of scheduled time
   * - jitter: 15 → executes between -15min and +15min
   * 
   * Only applies to recurring jobs (interval, cron). Ignored for 'once'.
   */
  jitter?: number;
}

/**
 * Trigger types supported by the cron system
 */
export type TriggerType = 'time' | 'file' | 'webhook';

/**
 * File watch configuration
 */
export interface FileWatchConfig {
  /**
   * Path or glob pattern to watch
   * Examples: "data/logs/files.log", ["src/code.ts", "tests/test.ts"]
   */
  path: string | string[];

  /**
   * File system event to watch
   */
  event: 'created' | 'modified' | 'deleted' | 'all';

  /**
   * Debounce time in milliseconds (default: 5000)
   */
  debounceMs?: number;

  /**
   * Ignore initial add events (default: true)
   */
  ignoreInitial?: boolean;
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig {
  /**
   * Unique webhook ID (auto-generated)
   */
  webhookId: string;

  /**
   * Secret for HMAC signature validation (auto-generated)
   */
  secret: string;

  /**
   * Rate limit: max requests per minute (default: 10)
   */
  rateLimit?: number;

  /**
   * IP whitelist (optional)
   */
  ipWhitelist?: string[];

  /**
   * Allowed HTTP methods (default: ['POST'])
   */
  allowedMethods?: ('POST' | 'GET')[];
}

/**
 * Trigger configuration (time-based or event-based)
 */
export interface CronTrigger {
  /**
   * Trigger type
   */
  type: TriggerType;

  /**
   * Time-based schedule (when type = 'time')
   */
  schedule?: CronSchedule;

  /**
   * File watch configuration (when type = 'file')
   */
  fileWatch?: FileWatchConfig;

  /**
   * Webhook trigger configuration (when type = 'webhook')
   */
  webhook?: WebhookTriggerConfig;
}

/**
 * Cron Job definition
 */
export interface CronJob {
  /**
   * Unique job identifier (UUID)
   */
  id: string;

  /**
   * Human-readable job name
   */
  name: string;

  /**
   * Prompt to execute when job runs
   */
  prompt: string;

  /**
   * Schedule configuration (legacy - use trigger for new jobs)
   */
  schedule: CronSchedule;

  /**
   * Trigger configuration (time-based or event-based)
   * When set, this takes precedence over 'schedule'
   */
  trigger?: CronTrigger;

  /**
   * Delivery target for output
   */
  deliver: DeliveryTarget;

  /**
   * Target identifier (e.g., Telegram chat ID)
   */
  deliverTo?: string;

  /**
   * Job status
   */
  status: JobStatus;

  /**
   * Last execution timestamp (ISO string)
   */
  lastRun?: string;

  /**
   * Next execution timestamp (ISO string)
   */
  nextRun?: string;

  /**
   * Creation timestamp (ISO string)
   */
  createdAt: string;

  /**
   * Last update timestamp (ISO string)
   */
  updatedAt: string;

  /**
   * User ID who owns this job
   */
  userId: string;

  /**
   * Maximum retry attempts on failure (default: 0)
   */
  maxRetries?: number;

  /**
   * Backoff time between retries in milliseconds (default: 60000 = 1min)
   */
  retryBackoffMs?: number;

  /**
   * Execution timeout in seconds (default: 300 = 5min)
   */
  timeoutSeconds?: number;

  /**
   * Current retry counter (internal, managed by scheduler)
   */
  retryCount?: number;

  /**
   * Delivery metadata (channel-specific configs)
   */
  deliveryMetadata?: {
    webhook?: {
      headers?: Record<string, string>;
      method?: 'POST' | 'GET';
    };
    email?: {
      subject?: string;
      cc?: string[];
    };
    whatsapp?: {
      groupJid?: string;
    };
  };

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Skill that created this job (for auto-cleanup)
   */
  createdBy?: string;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Group name for bulk operations
   */
  group?: string;

  /**
   * Permanent job (protected from accidental deletion)
   */
  permanent?: boolean;

  /**
   * Condition expression for conditional execution
   * 
   * Examples:
   * - "job:abc123.success" - Only run if job abc123 succeeded
   * - "job:xyz789.lastRun < 2h" - Only run if job xyz789 ran less than 2h ago
   * - "job:abc123.success AND job:xyz789.success" - Both must succeed
   * - "NOT job:abc123.failed" - Job abc123 must not have failed
   * 
   * Supported operators: AND, OR, NOT
   * Supported properties: .success, .failed, .lastRun, .status
   * Supported functions: age(jobId), count(jobId, period)
   */
  condition?: string;

  /**
   * Job IDs that this job depends on
   * Auto-extracted from condition expression
   */
  dependencies?: string[];
}

/**
 * Job execution output
 */
export interface CronJobOutput {
  /**
   * Job ID
   */
  jobId: string;

  /**
   * Job name
   */
  jobName: string;

  /**
   * Execution success flag
   */
  success: boolean;

  /**
   * Agent output (response)
   */
  output: string;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Execution duration in milliseconds
   */
  duration: number;

  /**
   * Execution timestamp (ISO string)
   */
  timestamp: string;

  /**
   * Tools used during execution
   */
  toolsUsed?: string[];

  /**
   * Token usage statistics
   */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /**
   * Whether this job was recovered from a missed execution
   */
  recovered?: boolean;

  /**
   * Original scheduled time (for recovered jobs)
   */
  originalScheduledTime?: string;
}

/**
 * Jobs persistence structure
 */
export interface CronJobsFile {
  /**
   * File format version
   */
  version: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;

  /**
   * Array of jobs
   */
  jobs: CronJob[];
}

/**
 * Recovery configuration for missed tasks
 */
export interface CronRecoveryConfig {
  /**
   * Enable/disable recovery feature
   */
  enabled: boolean;

  /**
   * Maximum time window (in hours) to look back for missed tasks
   */
  maxRecoveryWindowHours: number;

  /**
   * Whether to notify user when a task is recovered
   */
  notifyOnRecovery: boolean;
}
