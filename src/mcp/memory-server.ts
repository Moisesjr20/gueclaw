#!/usr/bin/env node
/**
 * GueClaw Memory MCP Server
 * 
 * Model Context Protocol server providing 3 progressive disclosure tools:
 * 1. gueclaw_memory_search    - Layer 1: Index search (low tokens ~50-100/result)
 * 2. gueclaw_memory_timeline  - Layer 2: Context timeline (medium tokens ~200-300)
 * 3. gueclaw_memory_get       - Layer 3: Full details (high tokens ~500-1K/result)
 * 
 * Usage with VS Code:
 * Add to config/mcp-servers.json and restart VS Code.
 * Use in Copilot Chat: @github [search query]
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchTool } from './tools/search-tool.js';
import { timelineTool } from './tools/timeline-tool.js';
import { getMemoriesTool } from './tools/get-memories-tool.js';
import { tokenTracker } from './utils/token-counter.js';

// Initialize MCP server
const server = new Server(
  {
    name: 'gueclaw-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions (schema for VS Code)
const TOOLS = [
  {
    name: 'gueclaw_memory_search',
    description: 
      'Search GueClaw memory index (Layer 1: ~50-100 tokens/result). ' +
      'Returns compact summaries with IDs for filtering before fetching full details. ' +
      'Use this first to discover relevant memories efficiently.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query or keywords (e.g., "OAuth authentication", "TypeScript decisions")',
        },
        type: {
          type: 'string',
          enum: ['preference', 'decision', 'fact', 'goal', 'skill', 'constraint', 'context'],
          description: 'Filter by memory type (optional)',
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by importance level (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 50)',
          default: 10,
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence score 0-1 (default: 0.7)',
          default: 0.7,
        },
        userId: {
          type: 'string',
          description: 'Filter by user ID (default: "all" - search across all users)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'gueclaw_memory_timeline',
    description: 
      'Get chronological context around a specific memory (Layer 2: ~200-300 tokens). ' +
      'Shows what was happening before/after for better understanding. ' +
      'Use after search to understand context.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'Memory ID from search results (format: mem_<timestamp>_<random>)',
        },
        before: {
          type: 'number',
          description: 'Number of memories before target (default: 3, max: 10)',
          default: 3,
        },
        after: {
          type: 'number',
          description: 'Number of memories after target (default: 3, max: 10)',
          default: 3,
        },
      },
      required: ['memoryId'],
    },
  },
  {
    name: 'gueclaw_memory_get',
    description: 
      'Get full memory details by IDs (Layer 3: ~500-1K tokens/result). ' +
      'Use after filtering with search. ALWAYS batch multiple IDs in one call for efficiency. ' +
      'This is the most token-expensive operation - use wisely.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of memory IDs to fetch (batch multiple for efficiency, max: 10)',
          minItems: 1,
          maxItems: 10,
        },
      },
      required: ['ids'],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[MCP] Executing tool: ${name}`, JSON.stringify(args, null, 2));

  try {
    let result;

    switch (name) {
      case 'gueclaw_memory_search':
        result = await searchTool(args as any);
        break;

      case 'gueclaw_memory_timeline':
        result = await timelineTool(args as any);
        break;

      case 'gueclaw_memory_get':
        result = await getMemoriesTool(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Log stats
    const stats = tokenTracker.getStats();
    console.error('[MCP] Token usage stats:', JSON.stringify(stats, null, 2));

    return {
      content: result.content,
      isError: result.isError,
    };
  } catch (error) {
    console.error(`[MCP] Error executing ${name}:`, error);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
              tool: name,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ GueClaw Memory MCP Server v1.0.0 running');
    console.error('📊 Progressive Disclosure enabled (3-layer workflow)');
    console.error('🔍 Tools: search, timeline, get');
    console.error('💡 Use Layer 1 (search) → Layer 2 (timeline) → Layer 3 (get) for optimal token usage');
  } catch (error) {
    console.error('❌ Fatal error starting MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n📊 Final token usage stats:', JSON.stringify(tokenTracker.getStats(), null, 2));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n📊 Final token usage stats:', JSON.stringify(tokenTracker.getStats(), null, 2));
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
