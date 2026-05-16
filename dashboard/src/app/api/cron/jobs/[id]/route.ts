/**
 * Cron Job API - Single Job Operations
 * 
 * GET    /api/cron/jobs/[id] - Get job details
 * PATCH  /api/cron/jobs/[id] - Update job (pause/resume/edit)
 * DELETE /api/cron/jobs/[id] - Delete job
 */

import { NextRequest, NextResponse } from 'next/server';
import { CronStorage } from '@/../../src/services/cron/cron-storage';
import { CronScheduler } from '@/../../src/services/cron/cron-scheduler';
import { calculateNextRun } from '@/../../src/services/cron/schedule-parser';

/**
 * GET /api/cron/jobs/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = CronStorage.getInstance();
    const job = storage.getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error: any) {
    console.error(`[CronAPI] GET /jobs/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch job', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cron/jobs/[id]
 * 
 * Body: {
 *   action?: 'pause' | 'resume' | 'update'
 *   name?: string
 *   prompt?: string
 *   tags?: string[]
 *   group?: string
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = CronStorage.getInstance();
    const body = await req.json();
    const { action, name, prompt, tags, group } = body;

    const job = storage.getJob(id);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (action === 'pause') {
      await storage.updateJob(id, { status: 'paused' });
      return NextResponse.json({ success: true, message: `Job "${job.name}" paused` });
    }

    if (action === 'resume') {
      const nextRun = calculateNextRun(job.schedule, new Date());
      await storage.updateJob(id, { status: 'active', nextRun: nextRun.toISOString() });
      return NextResponse.json({ success: true, message: `Job "${job.name}" resumed` });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (prompt !== undefined) updates.prompt = prompt;
    if (tags !== undefined) updates.tags = tags;
    if (group !== undefined) updates.group = group;

    if (Object.keys(updates).length > 0) {
      await storage.updateJob(id, updates);
      return NextResponse.json({ success: true, message: 'Job updated successfully' });
    }

    return NextResponse.json({ success: true, message: 'No changes made' });

  } catch (error: any) {
    console.error(`[CronAPI] PATCH /jobs/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to update job', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cron/jobs/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = CronStorage.getInstance();
    const scheduler = CronScheduler.getInstance();

    const job = storage.getJob(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.permanent) {
      return NextResponse.json({ error: 'Cannot delete permanent job' }, { status: 403 });
    }

    if (job.trigger?.type === 'webhook') {
      scheduler.unregisterJobWebhook(id);
    }

    const deleted = await storage.deleteJob(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Job "${job.name}" deleted successfully` });

  } catch (error: any) {
    console.error(`[CronAPI] DELETE /jobs/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to delete job', message: error.message },
      { status: 500 }
    );
  }
}
