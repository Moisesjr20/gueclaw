/**
 * Cron Storage
 * 
 * Handles persistence of cron jobs and execution outputs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { CronJob, CronJobOutput, CronJobsFile } from './cron-types';

/**
 * Storage paths
 */
const DATA_DIR = path.join(process.cwd(), 'data', 'cron');
const OUTPUT_DIR = path.join(DATA_DIR, 'output');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

/**
 * Cron Storage Manager
 */
export class CronStorage {
  private static instance: CronStorage;
  private lockFile: string;

  private constructor() {
    this.lockFile = path.join(DATA_DIR, '.lock');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CronStorage {
    if (!CronStorage.instance) {
      CronStorage.instance = new CronStorage();
    }
    return CronStorage.instance;
  }

  /**
   * Ensure required directories exist
   */
  public ensureDirs(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Acquire file lock (simple implementation)
   */
  private async acquireLock(): Promise<void> {
    let attempts = 0;
    while (fs.existsSync(this.lockFile) && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (attempts >= 50) {
      throw new Error('Failed to acquire lock after 5 seconds');
    }
    fs.writeFileSync(this.lockFile, String(process.pid));
  }

  /**
   * Release file lock
   */
  private releaseLock(): void {
    if (fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
    }
  }

  /**
   * Force release lock (for testing/cleanup)
   */
  public forceReleaseLock(): void {
    this.releaseLock();
  }

  /**
   * Reset storage for testing (deletes all jobs and outputs)
   */
  public resetForTesting(): void {
    this.forceReleaseLock();
    
    // Delete jobs file
    if (fs.existsSync(JOBS_FILE)) {
      fs.unlinkSync(JOBS_FILE);
    }
    
    // Delete all output files
    if (fs.existsSync(OUTPUT_DIR)) {
      const files = fs.readdirSync(OUTPUT_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
    
    this.ensureDirs();
  }

  /**
   * Load all jobs from file
   */
  public loadJobs(): CronJob[] {
    this.ensureDirs();

    if (!fs.existsSync(JOBS_FILE)) {
      return [];
    }

    try {
      const content = fs.readFileSync(JOBS_FILE, 'utf-8');
      const data: CronJobsFile = JSON.parse(content);
      return data.jobs || [];
    } catch (error) {
      console.error('[CronStorage] Failed to load jobs:', error);
      return [];
    }
  }

  /**
   * Save all jobs to file (atomic write)
   */
  public async saveJobs(jobs: CronJob[]): Promise<void> {
    this.ensureDirs();

    await this.acquireLock();

    try {
      const data: CronJobsFile = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        jobs
      };

      const tempFile = `${JOBS_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      
      // Atomic rename
      if (fs.existsSync(JOBS_FILE)) {
        fs.unlinkSync(JOBS_FILE);
      }
      fs.renameSync(tempFile, JOBS_FILE);

      console.log('[CronStorage] Saved', jobs.length, 'jobs');
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Create a new job
   */
  public async createJob(job: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<CronJob> {
    const jobs = this.loadJobs();

    const newJob: CronJob = {
      ...job,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    jobs.push(newJob);
    await this.saveJobs(jobs);

    return newJob;
  }

  /**
   * Update an existing job
   */
  public async updateJob(id: string, updates: Partial<CronJob>): Promise<CronJob | null> {
    const jobs = this.loadJobs();
    const index = jobs.findIndex(j => j.id === id);

    if (index === -1) {
      return null;
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
      id: jobs[index].id, // Preserve ID
      createdAt: jobs[index].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    await this.saveJobs(jobs);
    return jobs[index];
  }

  /**
   * Delete a job
   */
  public async deleteJob(id: string): Promise<boolean> {
    const jobs = this.loadJobs();
    const filtered = jobs.filter(j => j.id !== id);

    if (filtered.length === jobs.length) {
      return false; // Job not found
    }

    await this.saveJobs(filtered);
    return true;
  }

  /**
   * Get job by ID
   */
  public getJob(id: string): CronJob | null {
    const jobs = this.loadJobs();
    return jobs.find(j => j.id === id) || null;
  }

  /**
   * Get jobs by user ID
   */
  public getJobsByUser(userId: string): CronJob[] {
    const jobs = this.loadJobs();
    return jobs.filter(j => j.userId === userId);
  }

  /**
   * Save job execution output to file
   */
  public saveOutput(output: CronJobOutput): void {
    this.ensureDirs();

    const timestamp = new Date(output.timestamp).toISOString().replace(/[:.]/g, '-');
    const filename = `${output.jobId}_${timestamp}.md`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Build content with recovery info if applicable
    const titlePrefix = output.recovered ? '🔄 ' : '';
    const statusSuffix = output.recovered ? ' (RECOVERED)' : '';
    
    const content = [
      `# ${titlePrefix}${output.jobName}`,
      ``,
      `**Job ID:** \`${output.jobId}\`  `,
      `**Status:** ${output.success ? '✅ Success' : '❌ Failed'}${statusSuffix}  `,
      output.recovered ? `**Recovery:** Yes - job was executed after downtime  ` : '',
      output.originalScheduledTime ? `**Original Schedule:** ${output.originalScheduledTime}  ` : '',
      output.originalScheduledTime ? `**Actual Execution:** ${output.timestamp}  ` : `**Timestamp:** ${output.timestamp}  `,
      output.originalScheduledTime ? `**Delay:** ${this.calculateDelay(output.originalScheduledTime, output.timestamp)}  ` : '',
      `**Duration:** ${output.duration}ms  `,
      output.toolsUsed ? `**Tools Used:** ${output.toolsUsed.join(', ')}  ` : '',
      output.tokens ? `**Tokens:** ${output.tokens.total} (prompt: ${output.tokens.prompt}, completion: ${output.tokens.completion})  ` : '',
      ``,
      `---`,
      ``,
      output.success ? output.output : `## Error\n\n${output.error || 'Unknown error'}`,
      ``
    ].filter(line => line !== '').join('\n');

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log('[CronStorage] Saved output to', filename);
  }

  /**
   * Calculate delay between scheduled and actual execution
   */
  private calculateDelay(scheduledTime: string, actualTime: string): string {
    const scheduled = new Date(scheduledTime).getTime();
    const actual = new Date(actualTime).getTime();
    const delayMs = actual - scheduled;
    
    const hours = Math.floor(delayMs / (1000 * 60 * 60));
    const minutes = Math.floor((delayMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get recent outputs for a job
   */
  public getRecentOutputs(jobId: string, limit: number = 10): string[] {
    this.ensureDirs();

    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith(`${jobId}_`) && f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);

    return files.map(f => path.join(OUTPUT_DIR, f));
  }

  /**
   * Get job outputs as structured data (for condition evaluation)
   */
  public getJobOutputs(jobId: string, limit: number = 10): CronJobOutput[] {
    const filePaths = this.getRecentOutputs(jobId, limit);
    const outputs: CronJobOutput[] = [];

    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = path.basename(filePath);
        
        // Parse filename: jobId_timestamp.md
        const match = filename.match(/^([^_]+)_(.+)\.md$/);
        if (!match) continue;

        const timestamp = match[2].replace(/-/g, match[2].includes('T') ? ':' : '.');
        
        // Extract status from content
        const statusMatch = content.match(/\*\*Status:\*\* (.*?)(\r?\n|$)/);
        const success = statusMatch ? statusMatch[1].includes('✅') || statusMatch[1].includes('Success') : false;

        outputs.push({
          jobId: match[1],
          jobName: '', // Not needed for condition evaluation
          timestamp: timestamp.includes('T') ? timestamp : new Date(timestamp).toISOString(),
          success,
          output: '', // Not needed for condition evaluation
          duration: 0 // Not needed for condition evaluation
        });
      } catch (error) {
        // Skip invalid files
        continue;
      }
    }

    return outputs;
  }

  /**
   * Clean old outputs (keep last N per job)
   */
  public cleanOldOutputs(keepPerJob: number = 5): void {
    this.ensureDirs();

    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith('.md'));

    // Group by job ID
    const byJob: Record<string, string[]> = {};
    for (const file of files) {
      const jobId = file.split('_')[0];
      if (!byJob[jobId]) {
        byJob[jobId] = [];
      }
      byJob[jobId].push(file);
    }

    // Delete old outputs
    let deleted = 0;
    for (const jobId in byJob) {
      const jobFiles = byJob[jobId].sort().reverse();
      const toDelete = jobFiles.slice(keepPerJob);
      
      for (const file of toDelete) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log('[CronStorage] Cleaned', deleted, 'old output files');
    }
  }

  /**
   * Find jobs matching filter criteria
   */
  public findJobs(filter: {
    tags?: string[];
    group?: string;
    status?: 'active' | 'paused' | 'disabled';
    createdBy?: string;
  }): CronJob[] {
    const allJobs = this.loadJobs();
    
    return allJobs.filter(job => {
      // Filter by tags (job must have ALL specified tags)
      if (filter.tags && filter.tags.length > 0) {
        if (!job.tags || !filter.tags.every(tag => job.tags!.includes(tag))) {
          return false;
        }
      }

      // Filter by group
      if (filter.group && job.group !== filter.group) {
        return false;
      }

      // Filter by status
      if (filter.status && job.status !== filter.status) {
        return false;
      }

      // Filter by creator
      if (filter.createdBy && job.createdBy !== filter.createdBy) {
        return false;
      }

      return true;
    });
  }

  /**
   * Bulk pause jobs matching filter
   */
  public async bulkPause(filter: {
    tags?: string[];
    group?: string;
    createdBy?: string;
  }): Promise<{ count: number; jobs: string[] }> {
    await this.acquireLock();
    
    try {
      const allJobs = this.loadJobs();
      const matchingJobs = this.findJobs({ ...filter, status: 'active' });
      const jobIds: string[] = [];

      for (const match of matchingJobs) {
        const job = allJobs.find(j => j.id === match.id);
        if (job && job.status === 'active') {
          job.status = 'paused';
          job.updatedAt = new Date().toISOString();
          jobIds.push(job.id);
        }
      }

      if (jobIds.length > 0) {
        await this.saveJobsInternal(allJobs);
      }

      return { count: jobIds.length, jobs: jobIds };
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Bulk resume jobs matching filter
   */
  public async bulkResume(filter: {
    tags?: string[];
    group?: string;
    createdBy?: string;
  }): Promise<{ count: number; jobs: string[] }> {
    await this.acquireLock();
    
    try {
      const allJobs = this.loadJobs();
      const matchingJobs = this.findJobs({ ...filter, status: 'paused' });
      const jobIds: string[] = [];

      for (const match of matchingJobs) {
        const job = allJobs.find(j => j.id === match.id);
        if (job && job.status === 'paused') {
          job.status = 'active';
          job.updatedAt = new Date().toISOString();
          jobIds.push(job.id);
        }
      }

      if (jobIds.length > 0) {
        await this.saveJobsInternal(allJobs);
      }

      return { count: jobIds.length, jobs: jobIds };
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Bulk delete jobs matching filter (respects permanent flag)
   */
  public async bulkDelete(filter: {
    tags?: string[];
    group?: string;
    createdBy?: string;
  }): Promise<{ count: number; jobs: string[]; skipped: number }> {
    await this.acquireLock();
    
    try {
      const allJobs = this.loadJobs();
      const matchingJobs = this.findJobs(filter);
      const jobIds: string[] = [];
      let skipped = 0;

      // Remove matching jobs (except permanent ones)
      const remainingJobs = allJobs.filter(job => {
        const isMatch = matchingJobs.find(m => m.id === job.id);
        
        if (!isMatch) {
          return true; // Keep non-matching jobs
        }

        // Skip permanent jobs
        if (job.permanent) {
          skipped++;
          console.log(`[CronStorage] Skipping permanent job: ${job.id} (${job.name})`);
          return true;
        }

        // Delete this job
        jobIds.push(job.id);
        return false;
      });

      if (jobIds.length > 0) {
        await this.saveJobsInternal(remainingJobs);
      }

      return { count: jobIds.length, jobs: jobIds, skipped };
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Internal save method (assumes lock is already acquired)
   */
  private async saveJobsInternal(jobs: CronJob[]): Promise<void> {
    const data: CronJobsFile = {
      version: '1.0',
      jobs,
      updatedAt: new Date().toISOString(),
    };

    const tempFile = `${JOBS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });

    fs.renameSync(tempFile, JOBS_FILE);
  }
}
