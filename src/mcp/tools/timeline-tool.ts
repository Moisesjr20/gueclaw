/**
 * Timeline Tool (Layer 2: Chronological Context)
 * 
 * Returns chronological context around a specific memory (~200-300 tokens)
 * to understand what was happening before/after.
 */

import { MemoryManagerService } from '../../services/memory-extractor';
import { TimelineArgs, TimelineResponse, TimelineEntry, MCPToolResult } from '../types';
import { countTokensInObject, tokenTracker } from '../utils/token-counter';

/**
 * Execute timeline tool
 */
export async function timelineTool(args: TimelineArgs): Promise<MCPToolResult> {
  try {
    const memoryManager = MemoryManagerService.getInstance();

    // Get all memories to find the target
    const allMemories = memoryManager.repository.query({
      userId: undefined, // Search across all users
      includeExpired: false,
    });

    // Find target memory
    const targetMemory = allMemories.find((m) => m.id === args.memoryId);

    if (!targetMemory) {
      throw new Error(`Memory not found: ${args.memoryId}`);
    }

    // Get all memories from same conversation, sorted by time
    const conversationMemories = memoryManager.repository
      .getByConversation(targetMemory.conversationId)
      .sort((a, b) => a.extractedAt - b.extractedAt);

    // Find target index
    const targetIndex = conversationMemories.findIndex((m) => m.id === args.memoryId);

    if (targetIndex === -1) {
      throw new Error(`Memory ${args.memoryId} not found in conversation ${targetMemory.conversationId}`);
    }

    // Get before/after windows
    const beforeCount = args.before ?? 3;
    const afterCount = args.after ?? 3;

    const beforeMemories = conversationMemories.slice(
      Math.max(0, targetIndex - beforeCount),
      targetIndex
    );

    const afterMemories = conversationMemories.slice(
      targetIndex + 1,
      Math.min(conversationMemories.length, targetIndex + 1 + afterCount)
    );

    // Build timeline entries
    const timeline: TimelineEntry[] = [
      // Before entries
      ...beforeMemories.map((m, i) => ({
        id: m.id!,
        date: new Date(m.extractedAt).toISOString(),
        type: m.type,
        content: m.content,
        importance: m.importance,
        relativePosition: -(beforeMemories.length - i),
      })),
      // Target entry
      {
        id: targetMemory.id!,
        date: new Date(targetMemory.extractedAt).toISOString(),
        type: targetMemory.type,
        content: targetMemory.content,
        context: targetMemory.context,
        importance: targetMemory.importance,
        confidence: targetMemory.confidence,
        tags: targetMemory.tags,
        relativePosition: 0,
        isTarget: true,
      },
      // After entries
      ...afterMemories.map((m, i) => ({
        id: m.id!,
        date: new Date(m.extractedAt).toISOString(),
        type: m.type,
        content: m.content,
        importance: m.importance,
        relativePosition: i + 1,
      })),
    ];

    // Build response
    const response: TimelineResponse = {
      timeline,
      centerMemory: {
        id: targetMemory.id!,
        content: targetMemory.content,
        context: targetMemory.context,
        type: targetMemory.type,
        importance: targetMemory.importance,
        confidence: targetMemory.confidence,
      },
      conversationId: targetMemory.conversationId,
      windowSize: {
        before: beforeMemories.length,
        after: afterMemories.length,
      },
      tokensUsed: 0, // Will be calculated below
      nextSteps: [
        'Use gueclaw_memory_get(ids) to fetch full details of interesting timeline entries',
      ],
    };

    // Calculate token usage
    const tokens = countTokensInObject(response);
    response.tokensUsed = tokens;

    // Track usage
    tokenTracker.recordTimeline(tokens);

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
            tool: 'gueclaw_memory_timeline',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
