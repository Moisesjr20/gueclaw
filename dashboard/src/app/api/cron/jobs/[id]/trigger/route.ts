/**
 * Cron Job Trigger API
 * 
 * POST /api/cron/jobs/[id]/trigger - Manually trigger job execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { CronScheduler } from '@/../../src/services/cron/cron-scheduler';
import { CronStorage } from '@/../../src/services/cron/cron-storage';

/**
 * POST /api/cron/jobs/[id]/trigger
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storage = CronStorage.getInstance();
    const scheduler = CronScheduler.getInstance();

    const job = storage.getJob(params.id);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'active') {
      return NextResponse.json(
        { error: `Job is not active (status: ${job.status})` },
        { status: 400 }
      );
    }

    // Trigger job (runs in background)
    await scheduler.triggerJob(params.id);

    return NextResponse.json({
      success: true,
      message: `Job "${job.name}" triggered successfully (executing in background)`
    });

  } catch (error: any) {
    console.error(`[CronAPI] POST /jobs/${params.id}/trigger error:`, error);
    return NextResponse.json(
      { error: 'Failed to trigger job', message: error.message },
      { status: 500 }
    );
  }
}
