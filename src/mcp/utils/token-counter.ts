/**
 * Token Counter Utility
 * 
 * Provides fast, approximate token counting for MCP responses.
 * Uses the GPT-3/4 tokenization approximation (1 token ≈ 4 chars).
 */

/**
 * Count tokens in a string (approximate)
 * 
 * @param text - Text to count tokens for
 * @returns Approximate token count
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Simple approximation: 1 token ≈ 4 characters
  // This is conservative (tends to overestimate)
  const baseCount = Math.ceil(text.length / 4);

  // Add overhead for JSON structure (~10%)
  const withOverhead = Math.ceil(baseCount * 1.1);

  return withOverhead;
}

/**
 * Count tokens in an object (will be JSON stringified)
 * 
 * @param obj - Object to count tokens for
 * @returns Approximate token count
 */
export function countTokensInObject(obj: any): number {
  const jsonString = JSON.stringify(obj);
  return countTokens(jsonString);
}

/**
 * Estimate tokens for an array of strings
 * 
 * @param items - Array of strings
 * @returns Total approximate token count
 */
export function countTokensInArray(items: string[]): number {
  return items.reduce((total, item) => total + countTokens(item), 0);
}

/**
 * Format token count for display
 * 
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.2K tokens")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  }
  return `${(tokens / 1000).toFixed(1)}K tokens`;
}

/**
 * Calculate savings percentage
 * 
 * @param oldTokens - Original token count
 * @param newTokens - New token count
 * @returns Savings percentage (0-100)
 */
export function calculateSavings(oldTokens: number, newTokens: number): number {
  if (oldTokens === 0) return 0;
  const savings = ((oldTokens - newTokens) / oldTokens) * 100;
  return Math.max(0, Math.min(100, savings));
}

/**
 * Token usage tracker (in-memory stats)
 */
class TokenUsageTracker {
  private stats = {
    searchCalls: 0,
    timelineCalls: 0,
    getCalls: 0,
    totalTokensUsed: 0,
    searchTokens: 0,
    timelineTokens: 0,
    getTokens: 0,
  };

  recordSearch(tokens: number): void {
    this.stats.searchCalls++;
    this.stats.searchTokens += tokens;
    this.stats.totalTokensUsed += tokens;
  }

  recordTimeline(tokens: number): void {
    this.stats.timelineCalls++;
    this.stats.timelineTokens += tokens;
    this.stats.totalTokensUsed += tokens;
  }

  recordGet(tokens: number): void {
    this.stats.getCalls++;
    this.stats.getTokens += tokens;
    this.stats.totalTokensUsed += tokens;
  }

  getStats() {
    return {
      ...this.stats,
      averageTokensPerSearch:
        this.stats.searchCalls > 0 ? Math.round(this.stats.searchTokens / this.stats.searchCalls) : 0,
      averageTokensPerTimeline:
        this.stats.timelineCalls > 0 ? Math.round(this.stats.timelineTokens / this.stats.timelineCalls) : 0,
      averageTokensPerGet:
        this.stats.getCalls > 0 ? Math.round(this.stats.getTokens / this.stats.getCalls) : 0,
    };
  }

  reset(): void {
    this.stats = {
      searchCalls: 0,
      timelineCalls: 0,
      getCalls: 0,
      totalTokensUsed: 0,
      searchTokens: 0,
      timelineTokens: 0,
      getTokens: 0,
    };
  }
}

export const tokenTracker = new TokenUsageTracker();
