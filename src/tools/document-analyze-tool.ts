import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { MayanEDMSClient } from '../clients/mayan-edms-client';
import { DocumentSecurityAnalyzer } from '../services/document-security-analyzer';
import { OllamaCloudProvider } from '../core/providers/ollama-cloud-provider';
import { Message } from '../types';
import { z } from 'zod';

/**
 * Tool: Analyze document with AI (Ollama Cloud)
 * Usage: Extract insights, summarize, classify, and detect risks
 */
export class DocumentAnalyzeTool extends BaseTool {
  public readonly name = 'document_analyze';
  public readonly description = 'Analyze a document using AI to extract insights, summarize content, classify type, and detect risks';

  private mayanClient?: MayanEDMSClient;
  private securityAnalyzer: DocumentSecurityAnalyzer;
  private ollamaProvider?: OllamaCloudProvider;

  constructor() {
    super();
    this.securityAnalyzer = new DocumentSecurityAnalyzer();
    this.initializeMayanClient();
    this.initializeOllamaProvider();
  }

  private initializeMayanClient(): void {
    const apiUrl = process.env.MAYAN_API_URL;
    const apiToken = process.env.MAYAN_API_TOKEN;

    if (apiUrl && apiToken) {
      this.mayanClient = new MayanEDMSClient(apiUrl, apiToken);
    }
  }

  private initializeOllamaProvider(): void {
    const apiKey = process.env.OLLAMA_CLOUD_API_KEY;
    const baseURL = process.env.OLLAMA_CLOUD_BASE_URL;
    const model = process.env.OLLAMA_CLOUD_MODEL;

    if (apiKey) {
      this.ollamaProvider = new OllamaCloudProvider(
        apiKey,
        baseURL,
        model || 'deepseek-v4-flash'
      );
    }
  }

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          documentId: {
            type: 'number',
            description: 'Document ID in Mayan EDMS',
          },
          analysisType: {
            type: 'string',
            enum: ['summary', 'classification', 'risk-assessment', 'full', 'custom'],
            description: 'Type of analysis to perform',
          },
          customPrompt: {
            type: 'string',
            description: 'Custom analysis prompt (used when analysisType is "custom")',
          },
          includeOCR: {
            type: 'boolean',
            description: 'Include OCR-extracted text in analysis (default: true)',
          },
        },
        required: ['documentId'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const schema = z.object({
        documentId: z.number(),
        analysisType: z.enum(['summary', 'classification', 'risk-assessment', 'full', 'custom']).optional().default('full'),
        customPrompt: z.string().optional(),
        includeOCR: z.boolean().optional().default(true),
      });

      const validated = this.validateWithZod(args, schema);

      // Check if Mayan client is configured
      if (!this.mayanClient) {
        return this.error(
          'Mayan EDMS not configured. Set MAYAN_API_URL and MAYAN_API_TOKEN in .env'
        );
      }

      // Get document OCR text
      let documentText = '';
      if (validated.includeOCR) {
        try {
          const ocrResult = await this.mayanClient.getDocumentOCR(validated.documentId);
          documentText = ocrResult.content;
        } catch (ocrError: any) {
          console.warn('⚠️ OCR not available, trying document metadata:', ocrError.message);
        }
      }

      if (!documentText) {
        // Fallback: get document details
        const doc = await this.mayanClient.getDocument(validated.documentId);
        documentText = `Document: ${doc.label}\nType: ${doc.documentType || 'Unknown'}\nTags: ${doc.tags?.join(', ') || 'None'}`;
      }

      // Perform security analysis
      const securityAnalysis = await this.securityAnalyzer.analyze(documentText);

      // AI Analysis based on type
      let aiAnalysis: any = null;

      if (this.ollamaProvider && validated.analysisType !== 'custom') {
        aiAnalysis = await this.performAIAnalysis(documentText, validated.analysisType!);
      } else if (this.ollamaProvider && validated.analysisType === 'custom' && validated.customPrompt) {
        aiAnalysis = await this.performCustomAnalysis(documentText, validated.customPrompt);
      }

      // Build result
      const result: any = {
        documentId: validated.documentId,
        analysisType: validated.analysisType,
        securityClassification: securityAnalysis.classification,
        piiDetected: securityAnalysis.piiDetections,
        alerts: securityAnalysis.alerts,
      };

      if (aiAnalysis) {
        result.aiAnalysis = aiAnalysis;
      }

      // Format output message
      let output = `📄 Document Analysis Complete\n\n`;
      output += `🔒 Classification: ${securityAnalysis.classification.level.toUpperCase()}\n`;
      output += `⚠️ PII Items: ${securityAnalysis.piiDetections.length}\n`;
      output += `🏷️ Topics: ${securityAnalysis.classification.sensitiveTopics.join(', ') || 'None'}\n`;

      if (securityAnalysis.alerts.length > 0) {
        output += `\n🚨 Alerts:\n`;
        for (const alert of securityAnalysis.alerts) {
          output += `  - [${alert.severity.toUpperCase()}] ${alert.message}\n`;
        }
      }

      if (aiAnalysis) {
        output += `\n🤖 AI Analysis:\n${aiAnalysis.summary || aiAnalysis.insights || aiAnalysis.response}\n`;
      }

      return this.success(output, result);
    } catch (error: any) {
      return this.error(`Analysis failed: ${error.message}`);
    }
  }

  private async performAIAnalysis(
    text: string,
    analysisType: string
  ): Promise<any> {
    if (!this.ollamaProvider) return null;

    const prompts: Record<string, string> = {
      summary: `Summarize this document in 3-5 bullet points. Focus on key information, decisions, and action items. Document:\n"${text.substring(0, 4000)}"`,

      classification: `Classify this document by type (e.g., contract, invoice, report, email, legal, financial, medical). Also identify the department it belongs to. Return JSON: {"type": "...", "department": "...", "confidence": 0.0-1.0}. Document:\n"${text.substring(0, 4000)}"`,

      'risk-assessment': `Identify potential risks, compliance issues, or red flags in this document. Consider legal, financial, and operational risks. Return JSON: {"risks": [...], "complianceIssues": [...], "severity": "low|medium|high"}. Document:\n"${text.substring(0, 4000)}"`,

      full: `Analyze this document comprehensively. Return JSON with: {"summary": "3-5 bullet points", "type": "document type", "keyPoints": [...], "actionItems": [...], "risks": [...], "sentiment": "positive|neutral|negative"}. Document:\n"${text.substring(0, 3500)}"`,
    };

    const prompt = prompts[analysisType] || prompts.summary;

    const messages: Message[] = [
      {
        conversationId: 'document-analysis',
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.ollamaProvider.generateCompletion(messages);

    // Try to parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return { response: response.content };
      }
    }

    return { response: response.content };
  }

  private async performCustomAnalysis(
    text: string,
    customPrompt: string
  ): Promise<any> {
    if (!this.ollamaProvider) return null;

    const messages: Message[] = [
      {
        conversationId: 'document-analysis',
        role: 'user',
        content: `${customPrompt}\n\nDocument to analyze:\n"${text.substring(0, 4000)}"`,
      },
    ];

    const response = await this.ollamaProvider.generateCompletion(messages);

    return { response: response.content };
  }
}
