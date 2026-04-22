/**
 * Tags and Groups Tests
 * 
 * Tests for job tagging and grouping with bulk operations.
 */

import { CronStorage } from '../../../src/services/cron/cron-storage';
import type { CronJob } from '../../../src/services/cron/cron-types';

describe('Tags and Groups', () => {
  let storage: CronStorage;
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    storage = CronStorage.getInstance();
    // Reset storage completely (deletes files)
    storage.resetForTesting();
    // Wait a bit for file operations
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Cleanup
    storage.resetForTesting();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('job tagging', () => {
    test('should create job with tags', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'critical', 'monitoring']
      });

      expect(job.tags).toEqual(['production', 'critical', 'monitoring']);
    });

    test('should create job without tags', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId
      });

      expect(job.tags).toBeUndefined();
    });

    test('should update job tags', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['initial']
      });

      const updatedJob = await storage.updateJob(job.id, {
        tags: ['updated', 'new-tag']
      });

      expect(updatedJob).toBeTruthy();
      expect(updatedJob!.tags).toEqual(['updated', 'new-tag']);
    });

    test('should handle empty tags array', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: []
      });

      expect(job.tags).toEqual([]);
    });
  });

  describe('job grouping', () => {
    test('should create job with group', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'backup-jobs'
      });

      expect(job.group).toBe('backup-jobs');
    });

    test('should create job without group', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId
      });

      expect(job.group).toBeUndefined();
    });

    test('should update job group', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'old-group'
      });

      const updatedJob = await storage.updateJob(job.id, {
        group: 'new-group'
      });

      expect(updatedJob).toBeTruthy();
      expect(updatedJob!.group).toBe('new-group');
    });
  });

  describe('filtering by tags', () => {
    beforeEach(async () => {
      // Create test jobs with different tags
      await storage.createJob({
        name: 'Job 1',
        prompt: 'Prompt 1',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'critical']
      });

      await storage.createJob({
        name: 'Job 2',
        prompt: 'Prompt 2',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'monitoring']
      });

      await storage.createJob({
        name: 'Job 3',
        prompt: 'Prompt 3',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['development']
      });

      await storage.createJob({
        name: 'Job 4',
        prompt: 'Prompt 4',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId
        // No tags
      });
    });

    test('should filter jobs by single tag', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => job.tags?.includes('production'));
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(job => job.tags?.includes('production'))).toBe(true);
    });

    test('should filter jobs by multiple tags (AND logic)', () => {
      const jobs = storage.loadJobs();
      const requiredTags = ['production', 'critical'];
      const filtered = jobs.filter(job => 
        requiredTags.every(tag => job.tags?.includes(tag))
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Job 1');
    });

    test('should return empty array when no jobs match tags', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => job.tags?.includes('non-existent'));
      
      expect(filtered.length).toBe(0);
    });

    test('should filter jobs with any of multiple tags (OR logic)', () => {
      const jobs = storage.loadJobs();
      const anyTags = ['critical', 'monitoring'];
      const filtered = jobs.filter(job => 
        anyTags.some(tag => job.tags?.includes(tag))
      );
      
      expect(filtered.length).toBe(2);
    });
  });

  describe('filtering by group', () => {
    beforeEach(async () => {
      // Create test jobs with different groups
      await storage.createJob({
        name: 'Backup Job 1',
        prompt: 'Prompt 1',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'backups'
      });

      await storage.createJob({
        name: 'Backup Job 2',
        prompt: 'Prompt 2',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'backups'
      });

      await storage.createJob({
        name: 'Report Job 1',
        prompt: 'Prompt 3',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'reports'
      });

      await storage.createJob({
        name: 'Ungrouped Job',
        prompt: 'Prompt 4',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId
        // No group
      });
    });

    test('should filter jobs by group', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => job.group === 'backups');
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(job => job.group === 'backups')).toBe(true);
    });

    test('should return empty array when no jobs in group', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => job.group === 'non-existent');
      
      expect(filtered.length).toBe(0);
    });

    test('should find ungrouped jobs', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => !job.group);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Ungrouped Job');
    });
  });

  describe('bulk operations by tags', () => {
    let jobIds: string[];

    beforeEach(async () => {
      // Create test jobs
      const job1 = await storage.createJob({
        name: 'Job 1',
        prompt: 'Prompt 1',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'api']
      });

      const job2 = await storage.createJob({
        name: 'Job 2',
        prompt: 'Prompt 2',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'database']
      });

      const job3 = await storage.createJob({
        name: 'Job 3',
        prompt: 'Prompt 3',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['development']
      });

      jobIds = [job1.id, job2.id, job3.id];
    });

    test('should pause jobs by tags', async () => {
      const jobs = storage.loadJobs();
      const toPause = jobs.filter(job => job.tags?.includes('production'));
      
      // Pause filtered jobs
      for (const job of toPause) {
        await storage.updateJob(job.id, { status: 'paused' });
      }

      const allJobs = storage.loadJobs();
      const pausedJobs = allJobs.filter(job => job.status === 'paused');
      
      expect(pausedJobs.length).toBe(2);
      expect(pausedJobs.every(job => job.tags?.includes('production'))).toBe(true);
    });

    test('should resume jobs by tags', async () => {
      // First pause all production jobs
      let jobs = storage.loadJobs();
      const toPause = jobs.filter(job => job.tags?.includes('production'));
      
      for (const job of toPause) {
        await storage.updateJob(job.id, { status: 'paused' });
      }

      // Now resume them
      jobs = storage.loadJobs();
      const toResume = jobs.filter(job => 
        job.status === 'paused' && job.tags?.includes('production')
      );
      
      for (const job of toResume) {
        await storage.updateJob(job.id, { status: 'active' });
      }

      const allJobs = storage.loadJobs();
      const activeProductionJobs = allJobs.filter(job => 
        job.tags?.includes('production') && job.status === 'active'
      );
      
      expect(activeProductionJobs.length).toBe(2);
    });

    test('should delete jobs by tags', async () => {
      let jobs = storage.loadJobs();
      const toDelete = jobs.filter(job => job.tags?.includes('production'));
      
      // Delete filtered jobs
      for (const job of toDelete) {
        await storage.deleteJob(job.id);
      }

      jobs = storage.loadJobs();
      const remainingJobs = jobs.filter(job => job.tags?.includes('production'));
      
      expect(remainingJobs.length).toBe(0);
      expect(jobs.length).toBe(1); // Only development job remains
    });
  });

  describe('bulk operations by group', () => {
    beforeEach(async () => {
      // Create test jobs
      await storage.createJob({
        name: 'Backup Job 1',
        prompt: 'Prompt 1',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'backups'
      });

      await storage.createJob({
        name: 'Backup Job 2',
        prompt: 'Prompt 2',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'backups'
      });

      await storage.createJob({
        name: 'Report Job',
        prompt: 'Prompt 3',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'reports'
      });
    });

    test('should pause jobs by group', async () => {
      const jobs = storage.loadJobs();
      const toPause = jobs.filter(job => job.group === 'backups');
      
      for (const job of toPause) {
        await storage.updateJob(job.id, { status: 'paused' });
      }

      const allJobs = storage.loadJobs();
      const pausedBackups = allJobs.filter(job => 
        job.group === 'backups' && job.status === 'paused'
      );
      
      expect(pausedBackups.length).toBe(2);
    });

    test('should resume jobs by group', async () => {
      // First pause
      let jobs = storage.loadJobs();
      const toPause = jobs.filter(job => job.group === 'backups');
      
      for (const job of toPause) {
        await storage.updateJob(job.id, { status: 'paused' });
      }

      // Then resume
      jobs = storage.loadJobs();
      const toResume = jobs.filter(job => 
        job.group === 'backups' && job.status === 'paused'
      );
      
      for (const job of toResume) {
        await storage.updateJob(job.id, { status: 'active' });
      }

      const allJobs = storage.loadJobs();
      const activeBackups = allJobs.filter(job => 
        job.group === 'backups' && job.status === 'active'
      );
      
      expect(activeBackups.length).toBe(2);
    });

    test('should delete jobs by group', async () => {
      let jobs = storage.loadJobs();
      const toDelete = jobs.filter(job => job.group === 'backups');
      
      for (const job of toDelete) {
        await storage.deleteJob(job.id);
      }

      jobs = storage.loadJobs();
      const backupJobs = jobs.filter(job => job.group === 'backups');
      
      expect(backupJobs.length).toBe(0);
      expect(jobs.length).toBe(1); // Only report job remains
    });
  });

  describe('combined filtering (tags + group)', () => {
    beforeEach(async () => {
      await storage.createJob({
        name: 'Job 1',
        prompt: 'Prompt 1',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'critical'],
        group: 'backups'
      });

      await storage.createJob({
        name: 'Job 2',
        prompt: 'Prompt 2',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production'],
        group: 'backups'
      });

      await storage.createJob({
        name: 'Job 3',
        prompt: 'Prompt 3',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['production', 'critical'],
        group: 'reports'
      });
    });

    test('should filter by tags AND group', () => {
      const jobs = storage.loadJobs();
      const filtered = jobs.filter(job => 
        job.group === 'backups' && 
        job.tags?.includes('critical')
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Job 1');
    });

    test('should filter by multiple tags AND group', () => {
      const jobs = storage.loadJobs();
      const requiredTags = ['production', 'critical'];
      const filtered = jobs.filter(job => 
        job.group === 'backups' &&
        requiredTags.every(tag => job.tags?.includes(tag))
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Job 1');
    });
  });

  describe('edge cases', () => {
    test('should handle duplicate tags', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['tag1', 'tag1', 'tag2']
      });

      // Storage should preserve duplicate tags (or deduplicate - implementation dependent)
      expect(job.tags).toContain('tag1');
      expect(job.tags).toContain('tag2');
    });

    test('should handle special characters in tags', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: ['tag-with-dash', 'tag_with_underscore', 'tag.with.dot']
      });

      expect(job.tags).toEqual(['tag-with-dash', 'tag_with_underscore', 'tag.with.dot']);
    });

    test('should handle special characters in group name', async () => {
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        group: 'group-with-special_chars.123'
      });

      expect(job.group).toBe('group-with-special_chars.123');
    });

    test('should handle very long tag names', async () => {
      const longTag = 'a'.repeat(100);
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: [longTag]
      });

      expect(job.tags).toContain(longTag);
    });

    test('should handle many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      const job = await storage.createJob({
        name: 'Test Job',
        prompt: 'Test prompt',
        schedule: { type: 'once', value: new Date().toISOString(), description: 'Once' },
        deliver: 'local',
        status: 'active',
        userId: testUserId,
        tags: manyTags
      });

      expect(job.tags?.length).toBe(50);
    });
  });
});
