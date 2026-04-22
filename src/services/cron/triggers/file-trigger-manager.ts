/**
 * File Trigger Manager
 * 
 * Manages file system watchers for event-based job triggers.
 */

import chokidar from 'chokidar';
import type { FileWatchConfig } from '../cron-types';

export interface WatcherConfig {
  jobId: string;
  config: FileWatchConfig;
  onTrigger: (eventType: string, filePath: string) => void;
}

export class FileTriggerManager {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Register file watcher for a job
   */
  public registerFileWatch(
    jobId: string,
    config: FileWatchConfig,
    onTrigger: (eventType: string, filePath: string) => void
  ): void {
    // Unregister existing watcher if any
    this.unregisterFileWatch(jobId);

    console.log(`[FileTrigger] Registering watch for job ${jobId}:`, config.path);

    const watcher = chokidar.watch(config.path, {
      ignoreInitial: config.ignoreInitial !== false, // Default: true
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    // Event handler with debounce
    const handleEvent = (eventType: string, filePath: string) => {
      const debounceMs = config.debounceMs || 5000;
      const debounceKey = `${jobId}-${eventType}-${filePath}`;

      // Clear existing timer
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule new execution with debounce
      const timer = setTimeout(() => {
        console.log(
          `[FileTrigger] Job ${jobId} triggered by ${eventType} on ${filePath}`
        );
        onTrigger(eventType, filePath);
        this.debounceTimers.delete(debounceKey);
      }, debounceMs);

      this.debounceTimers.set(debounceKey, timer);
    };

    // Register events based on configuration
    if (config.event === 'all' || config.event === 'created') {
      watcher.on('add', (path) => handleEvent('created', path));
    }

    if (config.event === 'all' || config.event === 'modified') {
      watcher.on('change', (path) => handleEvent('modified', path));
    }

    if (config.event === 'all' || config.event === 'deleted') {
      watcher.on('unlink', (path) => handleEvent('deleted', path));
    }

    // Error handling
    watcher.on('error', (error) => {
      console.error(`[FileTrigger] Watcher error for job ${jobId}:`, error);
    });

    // Ready event
    watcher.on('ready', () => {
      console.log(`[FileTrigger] ✅ Watcher ready for job ${jobId}`);
    });

    this.watchers.set(jobId, watcher);
  }

  /**
   * Unregister file watcher for a job
   */
  public unregisterFileWatch(jobId: string): void {
    const watcher = this.watchers.get(jobId);

    if (watcher) {
      console.log(`[FileTrigger] Unregistering watch for job ${jobId}`);
      watcher.close();
      this.watchers.delete(jobId);
    }

    // Clear debounce timers
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(`${jobId}-`)) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
  }

  /**
   * Get all active watcher job IDs
   */
  public getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Cleanup all watchers
   */
  public cleanup(): void {
    console.log('[FileTrigger] Cleaning up all watchers');

    for (const [jobId, watcher] of this.watchers.entries()) {
      watcher.close();
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    this.watchers.clear();
    this.debounceTimers.clear();
  }
}
