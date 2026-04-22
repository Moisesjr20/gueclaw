/**
 * Webhook Trigger Manager
 * 
 * Manages webhook-based job triggers with HMAC validation and rate limiting.
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import type { WebhookTriggerConfig } from '../cron-types';

/**
 * Webhook rate limit tracker
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  jobId: string;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Webhook validation result
 */
export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  rateLimited?: boolean;
  payload?: WebhookPayload;
}

/**
 * Webhook Trigger Manager
 */
export class WebhookTriggerManager {
  private static instance: WebhookTriggerManager;
  
  // Map: webhookId => { config, jobId }
  private webhooks: Map<string, { config: WebhookTriggerConfig; jobId: string }> = new Map();
  
  // Rate limiting: webhookId => { count, resetAt }
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  private constructor() {
    // Cleanup rate limits every minute
    setInterval(() => this.cleanupRateLimits(), 60000);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebhookTriggerManager {
    if (!WebhookTriggerManager.instance) {
      WebhookTriggerManager.instance = new WebhookTriggerManager();
    }
    return WebhookTriggerManager.instance;
  }

  /**
   * Generate webhook ID (cryptographically secure)
   */
  public generateWebhookId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate webhook secret (cryptographically secure)
   */
  public generateSecret(): string {
    return randomBytes(32).toString('base64');
  }

  /**
   * Register a webhook for a job
   */
  public registerWebhook(jobId: string, config: WebhookTriggerConfig): void {
    this.webhooks.set(config.webhookId, { config, jobId });
    console.log(`[WebhookTrigger] Registered webhook ${config.webhookId} for job ${jobId}`);
  }

  /**
   * Unregister a webhook
   */
  public unregisterWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    this.rateLimits.delete(webhookId);
    console.log(`[WebhookTrigger] Unregistered webhook ${webhookId}`);
  }

  /**
   * Get webhook config
   */
  public getWebhook(webhookId: string): { config: WebhookTriggerConfig; jobId: string } | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Validate HMAC signature
   */
  public validateSignature(
    webhookId: string,
    signature: string,
    payload: string
  ): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return false;
    }

    try {
      // Calculate expected signature
      const hmac = createHmac('sha256', webhook.config.secret);
      hmac.update(payload);
      const expected = 'sha256=' + hmac.digest('hex');

      // Timing-safe comparison
      if (signature.length !== expected.length) {
        return false;
      }

      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch (error) {
      console.error('[WebhookTrigger] Signature validation error:', error);
      return false;
    }
  }

  /**
   * Check rate limit
   */
  public checkRateLimit(webhookId: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return false;
    }

    const limit = webhook.config.rateLimit || 10; // Default: 10 req/min
    const now = Date.now();
    const entry = this.rateLimits.get(webhookId);

    // No entry or expired
    if (!entry || now >= entry.resetAt) {
      this.rateLimits.set(webhookId, {
        count: 1,
        resetAt: now + 60000 // 1 minute window
      });
      return true;
    }

    // Check if within limit
    if (entry.count < limit) {
      entry.count++;
      return true;
    }

    // Rate limited
    return false;
  }

  /**
   * Validate IP address (if whitelist is configured)
   */
  public validateIp(webhookId: string, ip: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return false;
    }

    // No whitelist = allow all
    if (!webhook.config.ipWhitelist || webhook.config.ipWhitelist.length === 0) {
      return true;
    }

    // Check if IP is in whitelist
    return webhook.config.ipWhitelist.includes(ip);
  }

  /**
   * Validate HTTP method
   */
  public validateMethod(webhookId: string, method: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return false;
    }

    const allowed = webhook.config.allowedMethods || ['POST'];
    return allowed.includes(method.toUpperCase() as 'POST' | 'GET');
  }

  /**
   * Validate webhook request (complete validation)
   */
  public validateRequest(
    webhookId: string,
    signature: string,
    payload: string,
    ip: string,
    method: string
  ): WebhookValidationResult {
    // Check if webhook exists
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return {
        valid: false,
        error: 'Webhook not found'
      };
    }

    // Check rate limit
    if (!this.checkRateLimit(webhookId)) {
      return {
        valid: false,
        error: 'Rate limit exceeded',
        rateLimited: true
      };
    }

    // Validate IP
    if (!this.validateIp(webhookId, ip)) {
      return {
        valid: false,
        error: 'IP not whitelisted'
      };
    }

    // Validate method
    if (!this.validateMethod(webhookId, method)) {
      return {
        valid: false,
        error: 'Method not allowed'
      };
    }

    // Validate signature
    if (!this.validateSignature(webhookId, signature, payload)) {
      return {
        valid: false,
        error: 'Invalid signature'
      };
    }

    // Parse payload
    try {
      const data = JSON.parse(payload);
      return {
        valid: true,
        payload: {
          jobId: webhook.jobId,
          timestamp: new Date().toISOString(),
          data
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid JSON payload'
      };
    }
  }

  /**
   * Cleanup expired rate limits
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [webhookId, entry] of this.rateLimits.entries()) {
      if (now >= entry.resetAt) {
        this.rateLimits.delete(webhookId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[WebhookTrigger] Cleaned ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get all registered webhooks
   */
  public getAllWebhooks(): Array<{ webhookId: string; jobId: string; config: WebhookTriggerConfig }> {
    const result: Array<{ webhookId: string; jobId: string; config: WebhookTriggerConfig }> = [];
    
    for (const [webhookId, { config, jobId }] of this.webhooks.entries()) {
      result.push({ webhookId, jobId, config });
    }

    return result;
  }

  /**
   * Clear all webhooks (for testing)
   */
  public clearAll(): void {
    this.webhooks.clear();
    this.rateLimits.clear();
    console.log('[WebhookTrigger] Cleared all webhooks');
  }
}
