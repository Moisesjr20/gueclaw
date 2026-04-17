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

    const content = [
      `# ${output.jobName}`,
      ``,
      `**Job ID:** \`${output.jobId}\`  `,
      `**Status:** ${output.success ? '✅ Success' : '❌ Failed'}  `,
      `**Duration:** ${output.duration}ms  `,
      `**Timestamp:** ${output.timestamp}  `,
      output.toolsUsed ? `**Tools Used:** ${output.toolsUsed.join(', ')}  ` : '',
      output.tokens ? `**Tokens:** ${output.tokens.total} (prompt: ${output.tokens.prompt}, completion: ${output.tokens.completion})  ` : '',
      ``,
      `---`,
      ``,
      output.success ? output.output : `## Error\n\n${output.error || 'Unknown error'}`,
      ``
    ].join('\n');

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log('[CronStorage] Saved output to', filename);
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
}
