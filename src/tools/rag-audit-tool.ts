import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { RagDatabase } from '../services/rag/rag-database';
import { RagSearcher } from '../services/rag/rag-searcher';

export class RagAuditTool extends BaseTool {
  public readonly name = 'rag_audit';
  public readonly description = `Audita o índice RAG: lista documentos, exibe estatísticas e permite inspecionar
documentos individualmente.

Operações disponíveis:
- "list": Listar todos os documentos indexados (com filtros opcionais)
- "stats": Estatísticas do índice (contagens, níveis de segurança)
- "get": Detalhes de um documento específico pelo file_hash

Exemplos:
{"action":"list"}
{"action":"list","tags":["financeiro"],"securityLevel":"confidential"}
{"action":"stats"}
{"action":"get","fileHash":"abc123..."}`;

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'stats', 'get'],
            description: 'Operação de auditoria',
          },
          fileHash: {
            type: 'string',
            description: 'Hash do documento (requerido para action=get)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filtrar por tags (para action=list)',
          },
          securityLevel: {
            type: 'string',
            enum: ['public', 'internal', 'confidential', 'secret'],
            description: 'Filtrar por nível de segurança (para action=list)',
          },
          filename: {
            type: 'string',
            description: 'Filtrar por nome de arquivo, parcial (para action=list)',
          },
        },
        required: ['action'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (!RagDatabase.getInstance().isConnected()) {
      return this.error('RAG database não está conectado. Configure RAG_POSTGRES_URL no .env');
    }

    const { action, fileHash, tags, securityLevel, filename } = args;

    try {
      const searcher = new RagSearcher();

      if (action === 'list') {
        const docs = await searcher.listDocuments({ tags, securityLevel, filename });

        if (docs.length === 0) {
          return this.success('📂 Nenhum documento indexado encontrado com os filtros aplicados.', { count: 0 });
        }

        const lines: string[] = [`📚 **${docs.length} documento(s) no índice RAG:**\n`];
        for (const doc of docs) {
          const date = new Date(doc.indexedAt).toLocaleDateString('pt-BR');
          lines.push(
            `• **${doc.originalFilename}**\n` +
            `  Hash: \`${doc.fileHash.slice(0, 12)}…\` | ${this.formatBytes(doc.fileSizeBytes)}\n` +
            `  🔒 ${doc.securityLevel} | 👤 PII: ${doc.piiCount} | 🏷️ ${doc.tags.join(', ') || 'sem tags'}\n` +
            `  📅 Indexado em ${date}`
          );
        }

        return this.success(lines.join('\n'), { count: docs.length });
      }

      if (action === 'stats') {
        const pool = RagDatabase.getInstance().getPool();
        const [metaResult, chunkResult] = await Promise.all([
          pool.query(`
            SELECT
              COUNT(*) AS total_docs,
              SUM(file_size_bytes) AS total_bytes,
              SUM(pii_count) AS total_pii,
              COUNT(*) FILTER (WHERE security_level = 'public') AS public_count,
              COUNT(*) FILTER (WHERE security_level = 'internal') AS internal_count,
              COUNT(*) FILTER (WHERE security_level = 'confidential') AS confidential_count,
              COUNT(*) FILTER (WHERE security_level = 'secret') AS secret_count
            FROM document_metadata
          `),
          pool.query('SELECT COUNT(*) AS total_chunks FROM document_chunks'),
        ]);

        const m = metaResult.rows[0];
        const totalChunks = parseInt(chunkResult.rows[0].total_chunks, 10);
        const totalDocs = parseInt(m.total_docs, 10);

        return this.success(
          `📊 **Estatísticas do Índice RAG**\n\n` +
          `📄 Documentos: ${totalDocs}\n` +
          `📦 Chunks totais: ${totalChunks}\n` +
          `💾 Tamanho total: ${this.formatBytes(parseInt(m.total_bytes || '0', 10))}\n` +
          `👤 PII total detectado: ${m.total_pii ?? 0}\n\n` +
          `🔒 **Por nível de segurança:**\n` +
          `  • public: ${m.public_count}\n` +
          `  • internal: ${m.internal_count}\n` +
          `  • confidential: ${m.confidential_count}\n` +
          `  • secret: ${m.secret_count}`,
          { totalDocs, totalChunks }
        );
      }

      if (action === 'get') {
        if (!fileHash) return this.error('fileHash é obrigatório para action=get');

        const doc = await searcher.getDocument(fileHash);
        if (!doc) return this.error(`Documento com hash ${fileHash} não encontrado no índice`);

        const pool = RagDatabase.getInstance().getPool();
        const chunkResult = await pool.query(
          'SELECT COUNT(*) AS count FROM document_chunks WHERE file_hash = $1',
          [fileHash]
        );
        const chunkCount = parseInt(chunkResult.rows[0].count, 10);

        return this.success(
          `📄 **${doc.originalFilename}**\n\n` +
          `🔑 Hash: \`${doc.fileHash}\`\n` +
          `💾 Tamanho: ${this.formatBytes(doc.fileSizeBytes)}\n` +
          `🔒 Segurança: ${doc.securityLevel}\n` +
          `👤 PII detectados: ${doc.piiCount}\n` +
          `🏷️ Tags: ${doc.tags.join(', ') || 'nenhuma'}\n` +
          `📦 Chunks indexados: ${chunkCount}\n` +
          `📂 Armazenado em: ${doc.storedPath}\n` +
          `📅 Indexado em: ${new Date(doc.indexedAt).toLocaleString('pt-BR')}\n` +
          `🔄 Atualizado em: ${new Date(doc.updatedAt).toLocaleString('pt-BR')}`,
          { doc }
        );
      }

      return this.error(`Ação desconhecida: ${action}`);
    } catch (err: any) {
      return this.error(`Erro na auditoria RAG: ${err.message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
