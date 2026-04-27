import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { MayanEDMSClient } from '../clients/mayan-edms-client';
import { z } from 'zod';

/**
 * Tool: Query/Search documents in Mayan EDMS
 * Usage: Search documents by text, filters, or tags
 */
export class DocumentQueryTool extends BaseTool {
  public readonly name = 'document_query';
  public readonly description = 'Search and query documents in Mayan EDMS by text, date, type, or tags';

  private mayanClient?: MayanEDMSClient;

  constructor() {
    super();
    this.initializeMayanClient();
  }

  private initializeMayanClient(): void {
    const apiUrl = process.env.MAYAN_API_URL;
    const apiToken = process.env.MAYAN_API_TOKEN;

    if (apiUrl && apiToken) {
      this.mayanClient = new MayanEDMSClient(apiUrl, apiToken);
    }
  }

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query text (e.g., "contrato", "fatura")',
          },
          documentType: {
            type: 'number',
            description: 'Filter by document type ID',
          },
          tags: {
            type: 'array',
            items: { type: 'number' },
            description: 'Filter by tag IDs',
          },
          dateFrom: {
            type: 'string',
            description: 'Filter documents from this date (YYYY-MM-DD)',
          },
          dateTo: {
            type: 'string',
            description: 'Filter documents until this date (YYYY-MM-DD)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
        },
        required: ['query'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const schema = z.object({
        query: z.string(),
        documentType: z.number().optional(),
        tags: z.array(z.number()).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional().default(10),
      });

      const validated = this.validateWithZod(args, schema);

      // Check if Mayan client is configured
      if (!this.mayanClient) {
        return this.error(
          'Mayan EDMS not configured. Set MAYAN_API_URL and MAYAN_API_TOKEN in .env'
        );
      }

      // Test connection first
      const isConnected = await this.mayanClient.testConnection();
      if (!isConnected) {
        return this.error('Failed to connect to Mayan EDMS API');
      }

      // Search documents
      const results = await this.mayanClient.searchDocuments(validated.query, {
        documentType: validated.documentType,
        tags: validated.tags,
        dateFrom: validated.dateFrom,
        dateTo: validated.dateTo,
      });

      if (results.length === 0) {
        return this.success('No documents found matching your query', {
          query: validated.query,
          count: 0,
        });
      }

      // Format results
      const formattedResults = results.slice(0, validated.limit).map(doc => ({
        id: doc.id,
        label: doc.label,
        uuid: doc.uuid,
        version: doc.latestVersionLabel,
        created: doc.latestVersionCreated,
      }));

      return this.success(
        `Found ${results.length} document(s) matching "${validated.query}"`,
        {
          query: validated.query,
          count: results.length,
          returned: formattedResults.length,
          results: formattedResults,
        }
      );
    } catch (error: any) {
      return this.error(`Query failed: ${error.message}`);
    }
  }
}
