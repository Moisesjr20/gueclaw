/**
 * Skill Hook Manager
 * 
 * Manages lifecycle hooks for skills - onBoot, onActivate, onDeactivate, onShutdown
 */

import type { SkillDefinition } from '../tools/skill-tool/skill-definition';
import type { SkillHookContext, SkillHooks } from '../types/skill-hooks';
import type { CronScheduler } from '../services/cron/cron-scheduler';
import { CronStorage } from '../services/cron/cron-storage';

export class SkillHookManager {
  private static instance: SkillHookManager;
  private registeredSkills = new Map<string, SkillDefinition>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SkillHookManager {
    if (!SkillHookManager.instance) {
      SkillHookManager.instance = new SkillHookManager();
    }
    return SkillHookManager.instance;
  }

  /**
   * Register skill and execute onBoot hook
   */
  public async registerSkill(
    skillName: string,
    definition: SkillDefinition,
    cronScheduler: CronScheduler
  ): Promise<void> {
    this.registeredSkills.set(skillName, definition);

    if (definition.hooks?.onBoot) {
      const context = this.createContext(skillName, definition, cronScheduler);

      try {
        await definition.hooks.onBoot(context);
        console.log(`[SkillHooks] ✅ onBoot executed for skill: ${skillName}`);
      } catch (error) {
        console.error(`[SkillHooks] ❌ onBoot failed for skill ${skillName}:`, error);
      }
    }
  }

  /**
   * Execute onActivate hook
   */
  public async activateSkill(
    skillName: string,
    cronScheduler: CronScheduler
  ): Promise<void> {
    const definition = this.registeredSkills.get(skillName);

    if (!definition || !definition.hooks?.onActivate) {
      return;
    }

    const context = this.createContext(skillName, definition, cronScheduler);

    try {
      await definition.hooks.onActivate(context);
      console.log(`[SkillHooks] ✅ onActivate executed for skill: ${skillName}`);
    } catch (error) {
      console.error(`[SkillHooks] ❌ onActivate failed for skill ${skillName}:`, error);
    }
  }

  /**
   * Execute onDeactivate hook
   */
  public async deactivateSkill(
    skillName: string,
    cronScheduler: CronScheduler
  ): Promise<void> {
    const definition = this.registeredSkills.get(skillName);

    if (!definition || !definition.hooks?.onDeactivate) {
      return;
    }

    const context = this.createContext(skillName, definition, cronScheduler);

    try {
      await definition.hooks.onDeactivate(context);
      console.log(`[SkillHooks] ✅ onDeactivate executed for skill: ${skillName}`);
      
      // Auto-cleanup jobs created by this skill
      await this.cleanupSkillJobs(skillName, context);
    } catch (error) {
      console.error(`[SkillHooks] ❌ onDeactivate failed for skill ${skillName}:`, error);
    }
  }

  /**
   * Execute onShutdown in all active skills
   */
  public async shutdownAll(cronScheduler: CronScheduler): Promise<void> {
    console.log('[SkillHooks] Running shutdown hooks...');

    const promises: Promise<void>[] = [];

    for (const [skillName, definition] of this.registeredSkills.entries()) {
      if (definition.hooks?.onShutdown) {
        const context = this.createContext(skillName, definition, cronScheduler);
        promises.push(
          definition.hooks.onShutdown(context).catch((err) => {
            console.error(`[SkillHooks] onShutdown failed for ${skillName}:`, err);
          })
        );
      }
    }

    await Promise.all(promises);
    console.log('[SkillHooks] Shutdown hooks completed');
  }

  /**
   * Create hook context for a skill
   */
  private createContext(
    skillName: string,
    definition: SkillDefinition,
    cronScheduler: CronScheduler
  ): SkillHookContext {
    return {
      skillName,
      cronScheduler,
      cronStorage: CronStorage.getInstance(),
      config: this.loadSkillConfig(skillName),
      logger: (message: string) => {
        console.log(`[Skill:${skillName}] ${message}`);
      },
    };
  }

  /**
   * Load skill-specific config from environment variables
   * 
   * Example:
   * SKILL_VPS_SECURITY_SCANNER_ENABLED=true
   * → { enabled: 'true' }
   */
  private loadSkillConfig(skillName: string): Record<string, any> {
    const prefix = `SKILL_${skillName.toUpperCase().replace(/-/g, '_')}_`;
    const config: Record<string, any> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        config[configKey] = value;
      }
    }

    return config;
  }

  /**
   * Cleanup jobs created by a skill (called on deactivate)
   */
  private async cleanupSkillJobs(
    skillName: string,
    context: SkillHookContext
  ): Promise<void> {
    const jobs = context.cronStorage.loadJobs();
    const skillJobs = jobs.filter(
      (job) => job.createdBy === skillName && !job.permanent
    );

    if (skillJobs.length > 0) {
      context.logger(`Cleaning up ${skillJobs.length} auto-created job(s)`);

      for (const job of skillJobs) {
        await context.cronStorage.deleteJob(job.id);
        context.logger(`Deleted job: ${job.name} (${job.id})`);
      }
    }
  }

  /**
   * Get all registered skills
   */
  public getRegisteredSkills(): string[] {
    return Array.from(this.registeredSkills.keys());
  }
}
