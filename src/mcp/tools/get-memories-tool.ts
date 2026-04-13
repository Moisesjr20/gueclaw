/**
 * Get Memories Tool (Layer 3: Full Details)
 * 
 * Returns complete memory details (~500-1K tokens per memory).
 * ALWAYS batch multiple IDs in one call for efficiency.
 */

import { MemoryManagerService } from '../../services/memory-extractor';
import { GetMemoriesArgs, GetMemoriesResponse, FullMemoryDetails, MCPToolResult } from '../types';
import { countTokensInObject, tokenTracker } from '../utils/token-counter';

/**
 * Execute get memories tool
 */
export async function getMemoriesTool(args: GetMemoriesArgs): Promise<MCPToolResult> {
  try {
    if (!args.ids || args.ids.length === 0) {
      throw new Error('At least one memory ID is required. Use gueclaw_memory_search first to get IDs.');
    }

    const memoryManager = MemoryManagerService.getInstance();

    // Get all memories
    const allMemories = memoryManager.repository.query({
      userId: undefined, // Search across all users
      includeExpired: false,
    });

    // Filter by requested IDs
    const foundMemories = allMemories.filter((m) => m.id && args.ids.includes(m.id));

    // Identify not found IDs
    const notFound = args.ids.filter((id) => !foundMemories.find((m) => m.id === id));

    // Convert to full detail format
    const memories: FullMemoryDetails[] = foundMemories.map((m) => ({
      id: m.id!,
      conversationId: m.conversationId,
      userId: m.userId,
      type: m.type,
      content: m.content,
      context: m.context,
      importance: m.importance,
      confidence: m.confidence,
      sourceMessageIds: m.sourceMessageIds,
      tags: m.tags,
      extractedAt: m.extractedAt,
      extractedAtISO: new Date(m.extractedAt).toISOString(),
      expiresAt: m.expiresAt,
      metadata: m.metadata,
    }));

    // Build response
    const response: GetMemoriesResponse = {
      memories,
      totalFetched: memories.length,
      notFound,
      tokensUsed: 0, // Will be calculated below
    };

    // Calculate token usage
    const tokens = countTokensInObject(response);
    response.tokensUsed = tokens;

    // Track usage
    tokenTracker.recordGet(tokens);

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
            tool: 'gueclaw_memory_get',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
