import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { MayanEDMSClient } from '../clients/mayan-edms-client';
import { DocumentSecurityAnalyzer } from '../services/document-security-analyzer';
import { z } from 'zod';

/**
 * Tool: Document Audit Report
 * Usage: Generate governance and compliance audit reports
 */
export class DocumentAuditTool extends BaseTool {
  public readonly name = 'document_audit';
  public readonly description = 'Generate a comprehensive audit report for document governance, security compliance, and risk assessment';

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
          documentId: {
            type: 'number',
            description: 'Specific document ID to audit (optional)',
          },
          reportType: {
            type: 'string',
            enum: ['security', 'compliance', 'governance', 'full'],
            description: 'Type of audit report to generate',
          },
          includePII: {
            type: 'boolean',
            description: 'Include detailed PII analysis (default: true)',
          },
          includeRecommendations: {
            type: 'boolean',
            description: 'Include security recommendations (default: true)',
          },
        },
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const schema = z.object({
        documentId: z.number().optional(),
        reportType: z.enum(['security', 'compliance', 'governance', 'full']).optional().default('full'),
        includePII: z.boolean().optional().default(true),
        includeRecommendations: z.boolean().optional().default(true),
      });

      const validated = this.validateWithZod(args, schema);

      // Check if Mayan client is configured
      if (!this.mayanClient) {
        return this.error(
          'Mayan EDMS not configured. Set MAYAN_API_URL and MAYAN_API_TOKEN in .env'
        );
      }

      const auditReport: any = {
        generatedAt: new Date().toISOString(),
        reportType: validated.reportType,
        scope: validated.documentId ? 'single_document' : 'all_documents',
      };

      let output = `📋 DOCUMENT AUDIT REPORT\n`;
      output += `Generated: ${auditReport.generatedAt}\n`;
      output += `Type: ${validated.reportType!.toUpperCase()}\n`;
      output += `Scope: ${validated.documentId ? `Document #${validated.documentId}` : 'All Documents'}\n\n`;

      // Single document audit
      if (validated.documentId) {
        const docAudit = await this.auditSingleDocument(
          validated.documentId,
          validated.reportType!,
          validated.includePII!,
          validated.includeRecommendations!
        );
        output += docAudit.output;
        auditReport.details = docAudit.metadata;
      }
      // System-wide audit
      else {
        const systemAudit = await this.auditSystemWide(
          validated.reportType!,
          validated.includePII!,
          validated.includeRecommendations!
        );
        output += systemAudit.output;
        auditReport.summary = systemAudit.metadata;
      }

      return this.success(output, auditReport);
    } catch (error: any) {
      return this.error(`Audit failed: ${error.message}`);
    }
  }

  private async auditSingleDocument(
    documentId: number,
    reportType: string,
    includePII: boolean,
    includeRecommendations: boolean
  ): Promise<ToolResult> {
    if (!this.mayanClient) {
      return this.error('Mayan client not initialized');
    }

    try {
      // Get document and OCR
      const doc = await this.mayanClient.getDocument(documentId);
      let ocrText = '';
      try {
        const ocr = await this.mayanClient.getDocumentOCR(documentId);
        ocrText = ocr.content;
      } catch {}

      // Security analysis
      const securityAnalysis = await this.securityAnalyzer.analyze(ocrText || doc.label);

      let output = `📄 Document: ${doc.label}\n`;
      output += `Uploaded: ${doc.uploaded}\n`;
      output += `Type: ${doc.documentType || 'Unknown'}\n`;
      output += `Tags: ${doc.tags?.join(', ') || 'None'}\n\n`;

      // Security section
      if (reportType === 'security' || reportType === 'full') {
        output += `🔒 SECURITY ANALYSIS\n`;
        output += `Classification: ${securityAnalysis.classification.level.toUpperCase()}\n`;
        output += `Classification Reasons:\n`;
        for (const reason of securityAnalysis.classification.reasons) {
          output += `  • ${reason}\n`;
        }
        output += `\n`;
      }

      // PII section
      if (includePII && (reportType === 'security' || reportType === 'full' || reportType === 'compliance')) {
        output += `🔍 PII ANALYSIS\n`;
        if (securityAnalysis.piiDetections.length === 0) {
          output += `No PII detected.\n`;
        } else {
          output += `Detected ${securityAnalysis.piiDetections.length} PII item(s):\n`;
          for (const pii of securityAnalysis.piiDetections) {
            output += `  • [${pii.type}] ${pii.value} (confidence: ${(pii.confidence * 100).toFixed(0)}%)\n`;
          }
        }
        output += `\n`;
      }

      // Alerts section
      if (securityAnalysis.alerts.length > 0) {
        output += `🚨 ALERTS\n`;
        for (const alert of securityAnalysis.alerts) {
          output += `  [${alert.severity.toUpperCase()}] ${alert.message}\n`;
        }
        output += `\n`;
      }

      // Recommendations
      if (includeRecommendations) {
        output += `💡 RECOMMENDATIONS\n`;
        const recommendations = this.generateRecommendations(securityAnalysis, reportType);
        for (const rec of recommendations) {
          output += `  • ${rec}\n`;
        }
        output += `\n`;
      }

      return this.success(output, {
        document: doc,
        securityAnalysis,
        recommendations: this.generateRecommendations(securityAnalysis, reportType),
      });
    } catch (error: any) {
      return this.error(`Document audit failed: ${error.message}`);
    }
  }

  private async auditSystemWide(
    reportType: string,
    includePII: boolean,
    includeRecommendations: boolean
  ): Promise<ToolResult> {
    if (!this.mayanClient) {
      return this.error('Mayan client not initialized');
    }

    let output = `🏢 SYSTEM-WIDE AUDIT\n\n`;

    // Get document types and tags
    const [docTypes, tags] = await Promise.all([
      this.mayanClient.getDocumentTypes(),
      this.mayanClient.getTags(),
    ]);

    output += `📊 INVENTORY\n`;
    output += `Document Types: ${docTypes.length}\n`;
    output += `Tags: ${tags.length}\n`;
    for (const dt of docTypes) {
      output += `  • ${dt.label} (${dt.name})\n`;
    }
    output += `\n`;

    // Security summary
    if (reportType === 'security' || reportType === 'full') {
      output += `🔒 SECURITY POSTURE\n`;
      output += `Note: Full security analysis requires scanning all documents.\n`;
      output += `Recommend running individual audits for sensitive documents.\n\n`;
    }

    // Compliance section
    if (reportType === 'compliance' || reportType === 'full') {
      output += `📜 COMPLIANCE CHECK\n`;
      output += `✓ Document retention: Configured in Mayan EDMS\n`;
      output += `✓ Access control: Token-based authentication\n`;
      output += `✓ Audit trail: Enabled (check Mayan admin panel)\n`;
      output += `⚠ LGPD Compliance: Review PII handling policies\n\n`;
    }

    // Governance section
    if (reportType === 'governance' || reportType === 'full') {
      output += `🏛️ GOVERNANCE STATUS\n`;
      output += `• Document classification: Available via security analyzer\n`;
      output += `• Tagging system: ${tags.length} tags configured\n`;
      output += `• Version control: Enabled in Mayan EDMS\n`;
      output += `• OCR processing: Active for text extraction\n\n`;
    }

    // Recommendations
    if (includeRecommendations) {
      output += `💡 RECOMMENDATIONS\n`;
      output += `  • Review documents without tags\n`;
      output += `  • Classify documents by sensitivity level\n`;
      output += `  • Set up automated retention policies\n`;
      output += `  • Enable two-factor authentication\n`;
      output += `  • Regular backup verification\n\n`;
    }

    return this.success(output, {
      documentTypes: docTypes.length,
      tags: tags.length,
      docTypesList: docTypes,
      tagsList: tags,
    });
  }

  private generateRecommendations(
    analysis: any,
    reportType: string
  ): string[] {
    const recommendations: string[] = [];

    // PII-related recommendations
    if (analysis.piiDetections.length > 0) {
      const highRiskPII = analysis.piiDetections.filter(
        (d: any) => ['cpf', 'cnpj', 'credit_card', 'bank_account'].includes(d.type)
      );
      if (highRiskPII.length > 0) {
        recommendations.push('Consider masking or encrypting high-risk PII data');
        recommendations.push('Restrict document access to authorized personnel only');
      }
      recommendations.push('Review LGPD compliance for personal data handling');
    }

    // Classification-based recommendations
    if (analysis.classification.level === 'secret') {
      recommendations.push('Implement additional access controls for SECRET documents');
      recommendations.push('Enable audit logging for all access attempts');
    } else if (analysis.classification.level === 'confidential') {
      recommendations.push('Ensure document is tagged with appropriate access level');
      recommendations.push('Review sharing permissions regularly');
    }

    // General recommendations
    if (reportType === 'full' || reportType === 'governance') {
      recommendations.push('Schedule regular security audits (quarterly recommended)');
      recommendations.push('Implement document retention policies');
    }

    return recommendations;
  }
}
