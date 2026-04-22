/**
 * Skill Hook System
 * 
 * Lifecycle hooks for skills to auto-configure cron jobs and other resources
 */

import type { CronScheduler } from '../services/cron/cron-scheduler';
import type { CronStorage } from '../services/cron/cron-storage';

/**
 * Context provided to skill hooks
 */
export interface SkillHookContext {
  /**
   * Name of the skill
   */
  skillName: string;

  /**
   * Cron scheduler instance
   */
  cronScheduler: CronScheduler;

  /**
   * Cron storage instance
   */
  cronStorage: CronStorage;

  /**
   * Skill-specific config from environment variables
   * Loaded from SKILL_{SKILL_NAME}_{KEY} env vars
   */
  config: Record<string, any>;

  /**
   * Logger scoped to skill
   */
  logger: (message: string) => void;
}

/**
 * Lifecycle hooks for skills
 */
export interface SkillHooks {
  /**
   * Executed when skill is activated/installed
   * Can auto-register cron jobs
   */
  onActivate?: (context: SkillHookContext) => Promise<void>;

  /**
   * Executed when skill is deactivated/uninstalled
   * Should cleanup created cron jobs
   */
  onDeactivate?: (context: SkillHookContext) => Promise<void>;

  /**
   * Executed when agent boots (if skill is active)
   * Used for auto-configuration
   */
  onBoot?: (context: SkillHookContext) => Promise<void>;

  /**
   * Executed before agent shuts down
   * Resource cleanup
   */
  onShutdown?: (context: SkillHookContext) => Promise<void>;
}
