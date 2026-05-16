/**
 * Cron Job Outputs API
 * 
 * GET /api/cron/jobs/[id]/outputs - Get execution history/outputs for a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { CronStorage } from '@/../../src/services/cron/cron-storage';

/**
 * GET /api/cron/jobs/[id]/outputs
 * 
 * Query params:
 * - limit: number (default: 20)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = CronStorage.getInstance();
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    const job = storage.getJob(id);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const outputs = storage.getJobOutputs(id, limit);

    return NextResponse.json({
      success: true,
      outputs,
      count: outputs.length,
      jobName: job.name
    });

  } catch (error: any) {
    console.error(`[CronAPI] GET /jobs/${id}/outputs error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch outputs', message: error.message },
      { status: 500 }
    );
  }
}
