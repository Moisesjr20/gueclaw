/**
 * Webhook Trigger API Route
 * 
 * POST /api/webhook/trigger/:webhookId
 * 
 * Triggers a cron job via HTTP webhook with HMAC validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebhookTriggerManager } from '@/../../src/services/cron/triggers/webhook-trigger-manager';
import { CronScheduler } from '@/../../src/services/cron/cron-scheduler';

/**
 * Extract client IP from request
 */
function getClientIp(req: NextRequest): string {
  // Try various headers (behind proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to 'unknown' (local development)
  return 'unknown';
}

/**
 * POST /api/webhook/trigger/:webhookId
 * 
 * Headers required:
 * - X-Webhook-Signature: sha256=<hmac_signature>
 * 
 * Body: JSON payload
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params;

  try {
    // Get managers
    const webhookManager = WebhookTriggerManager.getInstance();
    const scheduler = CronScheduler.getInstance();

    // Get signature header
    const signature = req.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json(
        {
          error: 'Missing X-Webhook-Signature header',
          message: 'HMAC signature is required for webhook authentication'
        },
        { status: 401 }
      );
    }

    // Get client IP
    const clientIp = getClientIp(req);

    // Read body as text
    const rawBody = await req.text();

    // Validate request (signature, rate limit, IP, method)
    const validation = webhookManager.validateRequest(
      webhookId,
      signature,
      rawBody,
      clientIp,
      req.method
    );

    if (!validation.valid) {
      const statusCode = validation.rateLimited ? 429 : 403;
      return NextResponse.json(
        {
          error: validation.error,
          rateLimited: validation.rateLimited
        },
        { status: statusCode }
      );
    }

    // Trigger the job
    if (!validation.payload) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const { jobId, data } = validation.payload;

    // Trigger job with webhook payload context
    await scheduler.triggerJob(jobId, {
      webhookId,
      payload: data,
      ip: clientIp,
      timestamp: validation.payload.timestamp
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job triggered successfully',
      timestamp: validation.payload.timestamp
    });

  } catch (error: any) {
    console.error('[WebhookAPI] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhook/trigger/:webhookId
 * 
 * Optional: Some webhooks support GET for testing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params;

  try {
    const webhookManager = WebhookTriggerManager.getInstance();
    const webhook = webhookManager.getWebhook(webhookId);

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Check if GET is allowed
    const allowedMethods = webhook.config.allowedMethods || ['POST'];
    if (!allowedMethods.includes('GET')) {
      return NextResponse.json(
        { error: 'GET method not allowed for this webhook' },
        { status: 405 }
      );
    }

    // Same validation as POST (but with query params as payload)
    const signature = req.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing X-Webhook-Signature header' },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(req);
    const queryParams = Object.fromEntries(req.nextUrl.searchParams);
    const rawBody = JSON.stringify(queryParams);

    const validation = webhookManager.validateRequest(
      webhookId,
      signature,
      rawBody,
      clientIp,
      'GET'
    );

    if (!validation.valid) {
      const statusCode = validation.rateLimited ? 429 : 403;
      return NextResponse.json(
        {
          error: validation.error,
          rateLimited: validation.rateLimited
        },
        { status: statusCode }
      );
    }

    // Trigger the job
    const scheduler = CronScheduler.getInstance();
    await scheduler.triggerJob(webhook.jobId, {
      webhookId,
      payload: queryParams,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      jobId: webhook.jobId,
      message: 'Job triggered successfully'
    });

  } catch (error: any) {
    console.error('[WebhookAPI] Error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
