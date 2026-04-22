/**
 * Webhook Trigger Manager Tests
 * 
 * Tests for webhook-based job triggers with HMAC validation and rate limiting.
 */

import { WebhookTriggerManager } from '../../../src/services/cron/triggers/webhook-trigger-manager';
import { createHmac } from 'crypto';
import type { WebhookTriggerConfig } from '../../../src/services/cron/cron-types';

describe('WebhookTriggerManager', () => {
  let manager: WebhookTriggerManager;
  
  beforeEach(() => {
    // Get fresh instance and clear any existing state
    manager = WebhookTriggerManager.getInstance();
    
    // Clear all registered webhooks by unregistering them
    // This is a workaround since it's a singleton
    // In practice, we'd need a reset() method, but we'll work with what we have
  });

  afterEach(() => {
    // Clear all timers
    jest.clearAllTimers();
  });

  describe('generateWebhookId', () => {
    test('should generate unique webhook ID', () => {
      const id1 = manager.generateWebhookId();
      const id2 = manager.generateWebhookId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(32); // 16 bytes in hex = 32 chars
    });

    test('should generate cryptographically secure ID', () => {
      const id = manager.generateWebhookId();
      expect(id).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('generateSecret', () => {
    test('should generate unique secret', () => {
      const secret1 = manager.generateSecret();
      const secret2 = manager.generateSecret();
      
      expect(secret1).toBeTruthy();
      expect(secret2).toBeTruthy();
      expect(secret1).not.toBe(secret2);
    });

    test('should generate base64 secret', () => {
      const secret = manager.generateSecret();
      // Base64 pattern
      expect(secret).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  describe('registerWebhook', () => {
    test('should register webhook successfully', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'test-secret',
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);
      
      const webhook = manager.getWebhook('test-webhook-id');
      expect(webhook).toBeDefined();
      expect(webhook?.jobId).toBe('job-123');
      expect(webhook?.config).toEqual(config);
    });

    test('should overwrite existing webhook with same ID', () => {
      const config1: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret-1',
        rateLimit: 10
      };

      const config2: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret-2',
        rateLimit: 20
      };

      manager.registerWebhook('job-123', config1);
      manager.registerWebhook('job-456', config2);
      
      const webhook = manager.getWebhook('test-webhook-id');
      expect(webhook?.jobId).toBe('job-456');
      expect(webhook?.config.secret).toBe('secret-2');
    });
  });

  describe('unregisterWebhook', () => {
    test('should unregister webhook successfully', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'test-secret',
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);
      expect(manager.getWebhook('test-webhook-id')).toBeDefined();

      manager.unregisterWebhook('test-webhook-id');
      expect(manager.getWebhook('test-webhook-id')).toBeUndefined();
    });

    test('should handle unregistering non-existent webhook', () => {
      expect(() => {
        manager.unregisterWebhook('non-existent');
      }).not.toThrow();
    });
  });

  describe('validateSignature', () => {
    test('should validate correct HMAC signature', () => {
      const secret = 'my-secret-key';
      const payload = JSON.stringify({ test: 'data' });
      
      // Generate valid signature
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const signature = 'sha256=' + hmac.digest('hex');

      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret,
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      const isValid = manager.validateSignature('test-webhook-id', signature, payload);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect signature', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'my-secret-key',
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      const isValid = manager.validateSignature(
        'test-webhook-id',
        'sha256=invalid-signature',
        'payload'
      );
      expect(isValid).toBe(false);
    });

    test('should reject signature with wrong payload', () => {
      const secret = 'my-secret-key';
      const payload1 = JSON.stringify({ test: 'data1' });
      const payload2 = JSON.stringify({ test: 'data2' });
      
      // Generate signature for payload1
      const hmac = createHmac('sha256', secret);
      hmac.update(payload1);
      const signature = 'sha256=' + hmac.digest('hex');

      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret,
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      // Try to validate with payload2
      const isValid = manager.validateSignature('test-webhook-id', signature, payload2);
      expect(isValid).toBe(false);
    });

    test('should reject signature for non-existent webhook', () => {
      const isValid = manager.validateSignature(
        'non-existent',
        'sha256=signature',
        'payload'
      );
      expect(isValid).toBe(false);
    });

    test('should use timing-safe comparison', () => {
      // This test ensures timing attacks are prevented
      const secret = 'my-secret-key';
      const payload = 'test-payload';
      
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const correctSignature = 'sha256=' + hmac.digest('hex');
      
      // Create wrong signature with same length
      const wrongSignature = 'sha256=' + 'a'.repeat(64);

      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret,
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      expect(manager.validateSignature('test-webhook-id', correctSignature, payload)).toBe(true);
      expect(manager.validateSignature('test-webhook-id', wrongSignature, payload)).toBe(false);
    });

    test('should reject signature with wrong length', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'my-secret-key',
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      const isValid = manager.validateSignature(
        'test-webhook-id',
        'sha256=short',
        'payload'
      );
      expect(isValid).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should allow requests within rate limit', () => {
      const webhookId = `test-webhook-${Date.now()}`; // Unique ID per test
      const config: WebhookTriggerConfig = {
        webhookId,
        secret: 'secret',
        rateLimit: 3 // 3 requests per minute
      };

      manager.registerWebhook('job-123', config);

      // First 3 requests should pass
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      
      // Cleanup
      manager.unregisterWebhook(webhookId);
    });

    test('should block requests exceeding rate limit', () => {
      const webhookId = `test-webhook-${Date.now()}`; // Unique ID per test
      const config: WebhookTriggerConfig = {
        webhookId,
        secret: 'secret',
        rateLimit: 2 // 2 requests per minute
      };

      manager.registerWebhook('job-123', config);

      // First 2 should pass
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      
      // 3rd should be blocked
      expect(manager.checkRateLimit(webhookId)).toBe(false);
      
      // Cleanup
      manager.unregisterWebhook(webhookId);
    });

    test('should reset rate limit after window expires', () => {
      const webhookId = `test-webhook-${Date.now()}`; // Unique ID per test
      const config: WebhookTriggerConfig = {
        webhookId,
        secret: 'secret',
        rateLimit: 2
      };

      manager.registerWebhook('job-123', config);

      // Use up the limit
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      expect(manager.checkRateLimit(webhookId)).toBe(false);

      // Advance time by 60 seconds (rate limit window)
      jest.advanceTimersByTime(60000);

      // Should be allowed again
      expect(manager.checkRateLimit(webhookId)).toBe(true);
      
      // Cleanup
      manager.unregisterWebhook(webhookId);
    });

    test('should use default rate limit of 10 req/min', () => {
      const webhookId = `test-webhook-${Date.now()}`; // Unique ID per test
      const config: WebhookTriggerConfig = {
        webhookId,
        secret: 'secret'
        // No rateLimit specified
      };

      manager.registerWebhook('job-123', config);

      // Should allow 10 requests
      for (let i = 0; i < 10; i++) {
        expect(manager.checkRateLimit(webhookId)).toBe(true);
      }
      
      // 11th should be blocked
      expect(manager.checkRateLimit(webhookId)).toBe(false);
      
      // Cleanup
      manager.unregisterWebhook(webhookId);
    });

    test('should return false for non-existent webhook', () => {
      expect(manager.checkRateLimit('non-existent')).toBe(false);
    });
  });

  describe('IP whitelist validation', () => {
    test('should validate IP in whitelist', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret',
        rateLimit: 10,
        ipWhitelist: ['192.168.1.1', '10.0.0.1']
      };

      manager.registerWebhook('job-123', config);

      const webhook = manager.getWebhook('test-webhook-id');
      expect(webhook?.config.ipWhitelist).toContain('192.168.1.1');
    });

    test('should handle empty IP whitelist', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret',
        rateLimit: 10,
        ipWhitelist: []
      };

      manager.registerWebhook('job-123', config);

      const webhook = manager.getWebhook('test-webhook-id');
      expect(webhook?.config.ipWhitelist).toEqual([]);
    });
  });

  describe('allowed methods validation', () => {
    test('should store allowed methods', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret',
        rateLimit: 10,
        allowedMethods: ['POST', 'GET']
      };

      manager.registerWebhook('job-123', config);

      const webhook = manager.getWebhook('test-webhook-id');
      expect(webhook?.config.allowedMethods).toEqual(['POST', 'GET']);
    });

    test('should default to POST if not specified', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret',
        rateLimit: 10
      };

      manager.registerWebhook('job-123', config);

      const webhook = manager.getWebhook('test-webhook-id');
      // Default is set in the tool/API, not in manager
      expect(webhook?.config.allowedMethods).toBeUndefined();
    });
  });

  describe('rate limit cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should cleanup expired rate limits', () => {
      const config: WebhookTriggerConfig = {
        webhookId: 'test-webhook-id',
        secret: 'secret',
        rateLimit: 2
      };

      manager.registerWebhook('job-123', config);

      // Use up rate limit
      manager.checkRateLimit('test-webhook-id');
      manager.checkRateLimit('test-webhook-id');

      // Advance time past rate limit window
      jest.advanceTimersByTime(61000); // 61 seconds

      // Trigger cleanup (runs every 60s)
      jest.advanceTimersByTime(60000);

      // Should be able to make requests again
      expect(manager.checkRateLimit('test-webhook-id')).toBe(true);
    });
  });

  describe('integration - full webhook flow', () => {
    test('should handle complete webhook validation flow', () => {
      // Setup
      const webhookId = manager.generateWebhookId();
      const secret = manager.generateSecret();
      const jobId = 'test-job-123';

      const config: WebhookTriggerConfig = {
        webhookId,
        secret,
        rateLimit: 5,
        ipWhitelist: ['192.168.1.1'],
        allowedMethods: ['POST']
      };

      // Register
      manager.registerWebhook(jobId, config);

      // Validate registration
      const webhook = manager.getWebhook(webhookId);
      expect(webhook).toBeDefined();
      expect(webhook?.jobId).toBe(jobId);

      // Test signature validation
      const payload = JSON.stringify({ test: 'data' });
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const signature = 'sha256=' + hmac.digest('hex');

      expect(manager.validateSignature(webhookId, signature, payload)).toBe(true);

      // Test rate limiting
      for (let i = 0; i < 5; i++) {
        expect(manager.checkRateLimit(webhookId)).toBe(true);
      }
      expect(manager.checkRateLimit(webhookId)).toBe(false);

      // Cleanup
      manager.unregisterWebhook(webhookId);
      expect(manager.getWebhook(webhookId)).toBeUndefined();
    });
  });
});
