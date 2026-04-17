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
export type DeliveryTarget = 'telegram' | 'local' | 'none';

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
   * Schedule configuration
   */
  schedule: CronSchedule;

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
   * Additional metadata
   */
  metadata?: Record<string, any>;
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
