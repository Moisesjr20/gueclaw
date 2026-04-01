/**
 * Cost Tracker Tests
 */

import { costTracker, CostTracker } from '../../../src/services/cost-tracker/cost-tracker';
import { calculateCost, isProviderFree, getModelPricing } from '../../../src/services/cost-tracker/pricing';
import { estimateTokens, normalizeUsage } from '../../../src/services/cost-tracker/token-estimator';
import { DatabaseConnection } from '../../../src/core/memory/database';
import * as fs from 'fs';

describe('Cost Tracker', () => {
  beforeAll(() => {
    // Use in-memory database for tests
    process.env.DATABASE_PATH = ':memory:';
  });

  afterAll(() => {
    DatabaseConnection.close();
  });

  describe('Pricing', () => {
    test('Copilot provider should be FREE', () => {
      expect(isProviderFree('github-copilot')).toBe(true);
      const cost = calculateCost('github-copilot', 'claude-sonnet-4.5', {
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(cost).toBe(0);
    });

    test('GPT-4o should have correct pricing', () => {
      const pricing = getModelPricing('openai', 'gpt-4o');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPer1M).toBe(2.5);
      expect(pricing?.outputPer1M).toBe(10.0);
    });

    test('DeepSeek should have correct pricing', () => {
      const pricing = getModelPricing('deepseek', 'deepseek-chat');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPer1M).toBe(0.14);
      expect(pricing?.outputPer1M).toBe(0.28);
    });

    test('Cost calculation for GPT-4o should be accurate', () => {
      const cost = calculateCost('openai', 'gpt-4o', {
        inputTokens: 1000,
        outputTokens: 500,
      });
      // 1000 tokens = 0.001M tokens
      // Input: 0.001M * $2.5 = $0.0025
      // Output: 0.0005M * $10 = $0.005
      // Total: $0.0075
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    test('Cached tokens should reduce cost', () => {
      const costWithoutCache = calculateCost('openai', 'gpt-4o', {
        inputTokens: 1000,
        outputTokens: 500,
      });

      const costWithCache = calculateCost('openai', 'gpt-4o', {
        inputTokens: 0,
        outputTokens: 500,
        cachedInputTokens: 1000,
      });

      // Cached tokens cost 50% less ($1.25/M vs $2.5/M)
      expect(costWithCache).toBeLessThan(costWithoutCache);
      expect(costWithCache).toBeCloseTo(0.00625, 4); // 0.00125 (cached) + 0.005 (output)
    });
  });

  describe('Token Estimator', () => {
    test('Should estimate tokens for simple text', () => {
      const result = estimateTokens('Hello, world!');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.method).toBe('estimated');
      // "Hello, world!" ≈ 13 chars / 4 = ~3-4 tokens
      expect(result.tokens).toBeGreaterThanOrEqual(3);
      expect(result.tokens).toBeLessThanOrEqual(5);
    });

    test('Should handle empty text', () => {
      const result = estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.method).toBe('exact');
    });

    test('Should normalize OpenAI usage format', () => {
      const rawUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      };

      const normalized = normalizeUsage(rawUsage, 'openai');
      expect(normalized).toBeDefined();
      expect(normalized?.promptTokens).toBe(100);
      expect(normalized?.completionTokens).toBe(50);
      expect(normalized?.totalTokens).toBe(150);
    });

    test('Should normalize Claude/Anthropic usage format', () => {
      const rawUsage = {
        input_tokens: 200,
        output_tokens: 100,
        cache_read_input_tokens: 50,
      };

      const normalized = normalizeUsage(rawUsage, 'anthropic');
      expect(normalized).toBeDefined();
      expect(normalized?.promptTokens).toBe(200);
      expect(normalized?.completionTokens).toBe(100);
      expect(normalized?.totalTokens).toBe(300);
      expect(normalized?.cachedTokens).toBe(50);
    });

    test('Should normalize DeepSeek usage format', () => {
      const rawUsage = {
        prompt_cache_miss_tokens: 150,
        prompt_cache_hit_tokens: 50,
        completion_tokens: 75,
        total_tokens: 275,
      };

      const normalized = normalizeUsage(rawUsage, 'deepseek');
      expect(normalized).toBeDefined();
      expect(normalized?.promptTokens).toBe(150);
      expect(normalized?.completionTokens).toBe(75);
      expect(normalized?.cachedTokens).toBe(50);
    });
  });

  describe('Cost Tracker Manager', () => {
    test('Should track LLM call', async () => {
      await costTracker.trackLLMCall({
        provider: 'github-copilot',
        model: 'claude-sonnet-4.5',
        userId: 'test-user',
        operation: 'test-operation',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      // Verify record was inserted
      const summary = costTracker.getTodayCosts('test-user');
      expect(summary.requestCount).toBeGreaterThan(0);
      expect(summary.totalTokens).toBeGreaterThanOrEqual(150);
    });

    test('Should calculate summary correctly', async () => {
      const userId = 'summary-test-user';

      // Track multiple calls
      await costTracker.trackLLMCall({
        provider: 'openai',
        model: 'gpt-4o',
        userId,
        operation: 'test',
        usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
      });

      await costTracker.trackLLMCall({
        provider: 'deepseek',
        model: 'deepseek-chat',
        userId,
        operation: 'test',
        usage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 },
      });

      const summary = costTracker.getTodayCosts(userId);

      expect(summary.requestCount).toBe(2);
      expect(summary.totalTokens).toBe(4500);
      expect(summary.totalCostUSD).toBeGreaterThan(0);

      // Check provider breakdown
      expect(summary.byProvider['openai']).toBeDefined();
      expect(summary.byProvider['deepseek']).toBeDefined();
      expect(summary.byProvider['openai'].tokens).toBe(1500);
      expect(summary.byProvider['deepseek'].tokens).toBe(3000);
    });

    test('Should format summary for Telegram', () => {
      const summary = {
        totalCostUSD: 0.01523,
        totalTokens: 5000,
        requestCount: 3,
        byProvider: {
          'openai': { costUSD: 0.01, tokens: 3000, requests: 2 },
          'deepseek': { costUSD: 0.00523, tokens: 2000, requests: 1 },
        },
        byModel: {
          'openai/gpt-4o': { costUSD: 0.01, tokens: 3000, requests: 2 },
          'deepseek/deepseek-chat': { costUSD: 0.00523, tokens: 2000, requests: 1 },
        },
      };

      const message = costTracker.formatSummaryForTelegram(summary, 'Today');

      expect(message).toContain('Today');
      expect(message).toContain('$0.0152'); // Formatted cost
      expect(message).toMatch(/5[.,]000/); // Formatted tokens (locale-aware)
      expect(message).toContain('3'); // Request count
      expect(message).toContain('openai');
      expect(message).toContain('deepseek');
    });
  });
});
