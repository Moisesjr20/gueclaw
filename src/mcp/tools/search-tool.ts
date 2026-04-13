/**
 * Search Tool (Layer 1: Index Search)
 * 
 * Returns compact memory summaries (~50-100 tokens per result)
 * for efficient filtering before fetching full details.
 */

import { MemoryManagerService } from '../../services/memory-extractor';
import { SearchArgs, SearchResponse, MemoryIndexResult, MCPToolResult } from '../types';
import { countTokensInObject, tokenTracker } from '../utils/token-counter';
import { truncate } from '../utils/formatter';

/**
 * Execute search tool
 */
export async function searchTool(args: SearchArgs): Promise<MCPToolResult> {
  try {
    const memoryManager = MemoryManagerService.getInstance();

    // Default userId to 'all' if not specified (search across all users)
    const userId = args.userId || 'all';

    // Get memories from repository with filters
    let memories = memoryManager.repository.query({
      userId: userId === 'all' ? undefined : userId,
      types: args.type ? [args.type] : undefined,
      importance: args.importance ? [args.importance] : undefined,
      minConfidence: args.minConfidence ?? 0.7,
      limit: undefined, // We'll filter and limit after text search
      includeExpired: false,
    });

    // Filter by query text (simple text match for now)
    // TODO Phase 2: Replace with vector search for semantic matching
    if (args.query) {
      const queryLower = args.query.toLowerCase();
      memories = memories.filter((m) => {
        const searchText = `${m.content} ${m.context || ''} ${m.tags.join(' ')}`.toLowerCase();
        return searchText.includes(queryLower);
      });
    }

    // Apply limit
    const limit = args.limit ?? 10;
    memories = memories.slice(0, limit);

    // Convert to compact index format
    const results: MemoryIndexResult[] = memories.map((m) => ({
      id: m.id!,
      title: truncate(m.content, 80),
      type: m.type,
      importance: m.importance,
      confidence: m.confidence,
      date: new Date(m.extractedAt).toISOString(),
      tags: m.tags.slice(0, 5), // Limit tags for token efficiency
    }));

    // Build response
    const response: SearchResponse = {
      results,
      totalResults: results.length,
      query: args.query,
      filters: {
        type: args.type,
        importance: args.importance,
        minConfidence: args.minConfidence ?? 0.7,
        userId: args.userId,
      },
      tokensUsed: 0, // Will be calculated below
      nextSteps: [
        'Use gueclaw_memory_timeline(memoryId) to see chronological context around interesting results',
        'Use gueclaw_memory_get(ids: [...]) to fetch full details (batch multiple IDs for efficiency)',
      ],
    };

    // Calculate token usage
    const tokens = countTokensInObject(response);
    response.tokensUsed = tokens;

    // Track usage
    tokenTracker.recordSearch(tokens);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            tool: 'gueclaw_memory_search',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
