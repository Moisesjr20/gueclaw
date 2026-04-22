/**
 * Webhook Delivery Channel
 * 
 * Delivers cron job outputs via HTTP webhooks.
 */

import type { CronJob, CronJobOutput } from '../cron-types';

export class WebhookDelivery {
  /**
   * Send job output via webhook
   */
  public async send(job: CronJob, output: CronJobOutput): Promise<void> {
    const url = job.deliverTo;
    if (!url) {
      throw new Error('No webhook URL specified');
    }

    // Get webhook config
    const method = job.deliveryMetadata?.webhook?.method || 'POST';
    const headers = job.deliveryMetadata?.webhook?.headers || {};

    // Build payload
    const payload = {
      jobId: job.id,
      jobName: job.name,
      success: output.success,
      output: output.output,
      error: output.error,
      duration: output.duration,
      timestamp: output.timestamp,
      recovered: output.recovered,
      originalScheduledTime: output.originalScheduledTime,
      toolsUsed: output.toolsUsed,
      tokens: output.tokens
    };

    // Send webhook request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GueClaw-CronScheduler/1.0',
        ...headers
      },
      body: method === 'POST' ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Webhook delivery failed (${response.status}): ${error}`);
    }

    console.log(`[WebhookDelivery] ✅ Sent to ${url} (${response.status})`);
  }
}
