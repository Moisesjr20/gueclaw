import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { MayanEDMSClient } from '../clients/mayan-edms-client';
import { DocumentSecurityAnalyzer } from '../services/document-security-analyzer';
import { z } from 'zod';

/**
 * Tool: Upload document to Mayan EDMS
 * Usage: Upload files with automatic security analysis and tagging
 */
export class DocumentUploadTool extends BaseTool {
  public readonly name = 'document_upload';
  public readonly description = 'Upload a document to Mayan EDMS with automatic security classification and PII detection';

  private mayanClient?: MayanEDMSClient;
  private securityAnalyzer: DocumentSecurityAnalyzer;

  constructor() {
    super();
    this.securityAnalyzer = new DocumentSecurityAnalyzer();
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
          fileContent: {
            type: 'string',
            description: 'Base64 encoded file content or file path',
          },
          filename: {
            type: 'string',
            description: 'Name of the file (e.g., document.pdf)',
          },
          description: {
            type: 'string',
            description: 'Optional description of the document',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags to apply (e.g., ["financeiro", "contrato"])',
          },
          skipAnalysis: {
            type: 'boolean',
            description: 'Skip security analysis (default: false)',
          },
        },
        required: ['fileContent', 'filename'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const schema = z.object({
        fileContent: z.string(),
        filename: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        skipAnalysis: z.boolean().optional().default(false),
      });

      const validated = this.validateWithZod(args, schema);

      // Check if Mayan client is configured
      if (!this.mayanClient) {
        return this.error(
          'Mayan EDMS not configured. Set MAYAN_API_URL and MAYAN_API_TOKEN in .env'
        );
      }

      // Decode file content
      let fileBuffer: Buffer;
      try {
        if (validated.fileContent.startsWith('data:')) {
          // Data URL format
          const base64 = validated.fileContent.split(',')[1];
          fileBuffer = Buffer.from(base64, 'base64');
        } else {
          // Plain base64
          fileBuffer = Buffer.from(validated.fileContent, 'base64');
        }
      } catch (decodeError: any) {
        return this.error(`Failed to decode file: ${decodeError.message}`);
      }

      // Perform security analysis if not skipped
      let analysisResult = null;
      if (!validated.skipAnalysis) {
        const textContent = fileBuffer.toString('utf-8');
        analysisResult = await this.securityAnalyzer.analyze(textContent);

        // Check for critical alerts
        const criticalAlerts = analysisResult.alerts.filter(
          a => a.severity === 'critical' || a.severity === 'high'
        );

        if (criticalAlerts.length > 0) {
          console.warn('⚠️ Security alerts detected:', criticalAlerts);
        }
      }

      // Upload to Mayan EDMS - tags precisam ser números (IDs dos tags no Mayan)
      const uploadOptions: { filename?: string; description?: string; tags?: number[] } = {
        filename: validated.filename,
        description: validated.description,
      };
      // Se tags forem fornecidas como strings, converte para números (IDs)
      if (validated.tags && validated.tags.length > 0) {
        uploadOptions.tags = validated.tags.map(t => parseInt(t) || 0).filter(n => n > 0);
      }

      const document = await this.mayanClient.uploadDocument(fileBuffer, uploadOptions);

      // Build result
      const result: any = {
        id: document.id,
        uuid: document.uuid,
        label: document.label,
        uploaded: document.uploaded,
        securityClassification: analysisResult?.classification.level || 'not_analyzed',
        piiDetected: analysisResult?.piiDetections.length || 0,
      };

      if (analysisResult) {
        result.alerts = analysisResult.alerts;
        result.sensitiveTopics = analysisResult.classification.sensitiveTopics;
      }

      return this.success(
        `Document uploaded successfully: ${document.label} (ID: ${document.id})`,
        result
      );
    } catch (error: any) {
      return this.error(`Upload failed: ${error.message}`);
    }
  }
}
