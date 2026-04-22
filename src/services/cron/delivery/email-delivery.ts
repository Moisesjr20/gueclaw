/**
 * Email Delivery Channel
 * 
 * Delivers cron job outputs via email using nodemailer.
 */

import * as nodemailer from 'nodemailer';
import type { CronJob, CronJobOutput } from '../cron-types';

export class EmailDelivery {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.warn('[EmailDelivery] SMTP not configured (missing SMTP_* env vars)');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    console.log('[EmailDelivery] SMTP transporter initialized');
  }

  /**
   * Send job output via email
   */
  public async send(job: CronJob, output: CronJobOutput): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email delivery not configured (missing SMTP credentials)');
    }

    const to = job.deliverTo;
    if (!to) {
      throw new Error('No email address specified');
    }

    // Get custom subject or use default
    const subject = job.deliveryMetadata?.email?.subject 
      || `Cron Job ${output.success ? 'Completed' : 'Failed'}: ${job.name}`;

    // Build HTML email
    const html = this.formatHtml(job, output);

    // Send email
    const info = await this.transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      cc: job.deliveryMetadata?.email?.cc?.join(', '),
      subject,
      html
    });

    console.log(`[EmailDelivery] ✅ Sent to ${to} (Message ID: ${info.messageId})`);
  }

  /**
   * Format output as HTML email
   */
  private formatHtml(job: CronJob, output: CronJobOutput): string {
    const statusColor = output.success ? '#4CAF50' : '#f44336';
    const statusIcon = output.success ? '✅' : '❌';
    const recoveryBadge = output.recovered 
      ? '<span style="background: #FF9800; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-left: 8px;">RECOVERED</span>' 
      : '';

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${statusColor}; color: white; padding: 15px; border-radius: 5px; }
    .content { background: #f9f9f9; padding: 20px; margin-top: 20px; border-radius: 5px; }
    .meta { font-size: 12px; color: #666; margin-top: 20px; }
    pre { background: #fff; padding: 15px; border-left: 3px solid ${statusColor}; overflow-x: auto; }
    .error { color: #f44336; background: #ffebee; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${statusIcon} ${job.name} ${recoveryBadge}</h2>
    </div>
    <div class="content">
`;

    if (output.success) {
      html += `<pre>${this.escapeHtml(output.output)}</pre>`;
    } else {
      html += `<div class="error"><strong>Error:</strong> ${this.escapeHtml(output.error || 'Unknown error')}</div>`;
    }

    html += `
      <div class="meta">
        <strong>Job ID:</strong> ${job.id}<br>
        <strong>Status:</strong> ${output.success ? 'Success' : 'Failed'}<br>
        <strong>Duration:</strong> ${output.duration}ms<br>
        <strong>Timestamp:</strong> ${output.timestamp}<br>
`;

    if (output.recovered && output.originalScheduledTime) {
      html += `
        <strong>Original Schedule:</strong> ${output.originalScheduledTime}<br>
        <strong>Delay:</strong> ${this.calculateDelay(output.originalScheduledTime, output.timestamp)}<br>
`;
    }

    if (output.toolsUsed && output.toolsUsed.length > 0) {
      html += `<strong>Tools Used:</strong> ${output.toolsUsed.join(', ')}<br>`;
    }

    if (output.tokens) {
      html += `<strong>Tokens:</strong> ${output.tokens.total} (prompt: ${output.tokens.prompt}, completion: ${output.tokens.completion})<br>`;
    }

    html += `
      </div>
    </div>
  </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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
}
