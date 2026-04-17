import { BaseTool } from './base-tool';
import { SessionSearcher, SearchOptions } from '../core/memory/session-searcher';
import { ToolResult } from '../types';
import { ToolDefinition } from '../core/providers/base-provider';

/**
 * Session Search Tool - Search across conversation history
 * 
 * Uses FTS5 full-text search to find relevant conversations.
 * Returns grouped results by conversation with relevance scoring.
 */
export class SessionSearchTool extends BaseTool {
  name = 'search_conversations';
  description = 
    'Search across conversation history using full-text search. ' +
    'Returns relevant conversations with context and snippets. ' +
    'Useful for finding past discussions, commands, or information.';

  schema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 
          'Search query. Supports phrases in quotes "like this". ' +
          'Examples: "docker container", "how to backup", "error message"',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of conversations to return (default: 5)',
      },
      roleFilter: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['user', 'assistant', 'system', 'tool'],
        },
        description: 'Filter by message role. Example: ["user"] for user messages only',
      },
      includeContext: {
        type: 'boolean',
        description: 'Include surrounding context (3 messages before/after match). Default: false',
      },
      dateFrom: {
        type: 'string',
        description: 'ISO date string for start date filter (e.g., "2026-04-01T00:00:00Z")',
      },
      dateTo: {
        type: 'string',
        description: 'ISO date string for end date filter',
      },
    },
    required: ['query'],
  };

  isConcurrencySafe = true; // Read-only operation

  private searcher: SessionSearcher;

  constructor() {
    super();
    this.searcher = new SessionSearcher();
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.schema,
      isConcurrencySafe: this.isConcurrencySafe,
    };
  }

  async execute(input: Record<string, any>): Promise<ToolResult> {
    const { 
      query, 
      maxResults = 5, 
      roleFilter, 
      includeContext = false,
      dateFrom,
      dateTo 
    } = input;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        output: 'Error: Search query is required and must be a non-empty string',
      };
    }

    try {
      // Parse date filters if provided
      const options: SearchOptions = {
        maxResults: Math.min(maxResults, 20), // Cap at 20
        roleFilter: roleFilter as any,
        includeContext,
      };

      if (dateFrom) {
        options.dateFrom = Math.floor(new Date(dateFrom).getTime() / 1000);
      }

      if (dateTo) {
        options.dateTo = Math.floor(new Date(dateTo).getTime() / 1000);
      }

      // Execute search
      const results = await this.searcher.searchSessions(query, options);

      if (results.length === 0) {
        return {
          success: true,
          output: `No conversations found matching "${query}"`,
        };
      }

      // Format output
      const output = this.formatResults(results);

      return {
        success: true,
        output,
      };
    } catch (error: any) {
      console.error('❌ Session search failed:', error);
      return {
        success: false,
        output: `Search error: ${error.message}`,
      };
    }
  }

  /**
   * Format search results for display
   */
  private formatResults(results: any[]): string {
    let output = `# Search Results (${results.length} conversations)\n\n`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const relevance = (result.relevanceScore * 100).toFixed(0);
      
      output += `## ${i + 1}. Conversation (Relevance: ${relevance}%)\n\n`;
      output += `**ID:** ${result.conversationId}\n`;
      output += `**Matches:** ${result.matchCount}\n`;

      if (result.timeRange) {
        const start = new Date(result.timeRange.start * 1000).toLocaleString();
        const end = new Date(result.timeRange.end * 1000).toLocaleString();
        output += `**Time Range:** ${start} → ${end}\n`;
      }

      if (result.messageCount) {
        output += `**Total Messages:** ${result.messageCount}\n`;
      }

      if (result.firstMessage) {
        const preview = result.firstMessage.substring(0, 100);
        output += `**Started with:** "${preview}${result.firstMessage.length > 100 ? '...' : ''}"\n`;
      }

      output += `\n### Matched Snippets:\n\n`;

      for (const match of result.matches.slice(0, 3)) { // Show top 3 matches per conversation
        const date = new Date(match.timestamp * 1000).toLocaleString();
        output += `- **[${match.role}]** (${date})\n`;
        output += `  ${match.snippet}\n\n`;
      }

      if (result.matches.length > 3) {
        output += `  _(${result.matches.length - 3} more matches in this conversation)_\n\n`;
      }

      output += `---\n\n`;
    }

    output += `\n**Tip:** Use the conversation ID to load the full conversation context.`;

    return output;
  }
}
