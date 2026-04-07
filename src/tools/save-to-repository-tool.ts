import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';

const FILES_DIR = '/opt/gueclaw-data/files';

// Ensure directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

/**
 * Tool for saving files to the centralized repository
 * Files are accessible via web dashboard for download/preview
 */
export class SaveToRepositoryTool extends BaseTool {
  public readonly name = 'save_to_repository';
  public readonly description = `
Save a file (HTML, JSON, TXT, MD, CSV, etc) to the centralized file repository.
Files saved here are accessible via the web dashboard for download or preview.

Use this tool WHENEVER you create a file that the user should be able to access later.

Examples:
- HTML pages (carousels, landing pages, etc)
- JSON data exports
- CSV reports
- Markdown documents
- Text files

DO NOT use for temporary files or internal data.
  `.trim();

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Name of the file (with extension). Example: "carrossel-vendas.html"',
          },
          content: {
            type: 'string',
            description: 'Content of the file (text or base64 for binaries)',
          },
          description: {
            type: 'string',
            description: 'Optional description of what this file contains',
          },
        },
        required: ['filename', 'content'],
      },
    };
  }

  public async execute(args: any): Promise<ToolResult> {
    try {
      const { filename, content, description } = args;

      if (!filename || !content) {
        throw new Error('filename and content are required');
      }

      // Sanitize filename (prevent path traversal)
      const safeName = path.basename(filename);
      if (safeName !== filename) {
        throw new Error('Invalid filename (path traversal attempt)');
      }

      // Check if file already exists
      const filePath = path.join(FILES_DIR, safeName);
      const fileExists = fs.existsSync(filePath);

      // Write file
      fs.writeFileSync(filePath, content, 'utf8');

      // Get file stats
      const stats = fs.statSync(filePath);
      let sizeFormatted = '';
      if (stats.size < 1024) {
        sizeFormatted = `${stats.size} B`;
      } else if (stats.size < 1024 * 1024) {
        sizeFormatted = `${(stats.size / 1024).toFixed(1)} KB`;
      } else {
        sizeFormatted = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
      }

      const action = fileExists ? 'atualizado' : 'salvo';
      const ext = path.extname(safeName).slice(1).toUpperCase() || 'TXT';

      let result = `✅ Arquivo ${action} com sucesso!\n\n`;
      result += `📄 **Nome:** ${safeName}\n`;
      result += `📏 **Tamanho:** ${sizeFormatted}\n`;
      result += `📝 **Formato:** ${ext}\n`;
      result += `📍 **Localização:** Repositório de Arquivos\n`;
      
      if (description) {
        result += `💬 **Descrição:** ${description}\n`;
      }

      result += `\n🌐 **Acesso:**\n`;
      result += `- Dashboard Web: aba "Arquivos"\n`;
      result += `- Visualizar/Baixar disponível\n`;
      
      if (ext === 'HTML') {
        result += `\n💡 **Dica:** Você pode abrir este arquivo no navegador para visualizar!`;
      }

      return { success: true, output: result };
    } catch (error: any) {
      return { success: false, output: '', error: `Erro ao salvar arquivo: ${error.message}` };
    }
  }
}
