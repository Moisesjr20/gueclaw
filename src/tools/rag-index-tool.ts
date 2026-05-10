import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { RagDatabase } from '../services/rag/rag-database';
import { RagIndexer } from '../services/rag/rag-indexer';

export class RagIndexTool extends BaseTool {
  public readonly name = 'rag_index';
  public readonly description = `Indexa documentos locais no banco vetorial (RAG) para busca semântica posterior.

Operações disponíveis:
- "index": Indexar um arquivo (PDF ou texto) pelo caminho no filesystem
- "remove": Remover documento do índice pelo file_hash

Exemplos:
{"action":"index","filePath":"/data/docs/relatorio.pdf","tags":["financeiro","2026"]}
{"action":"remove","fileHash":"abc123..."}`;

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['index', 'remove'],
            description: 'Operação a executar',
          },
          filePath: {
            type: 'string',
            description: 'Caminho absoluto do arquivo a indexar (requerido para action=index)',
          },
          fileHash: {
            type: 'string',
            description: 'Hash SHA-256 do documento a remover (requerido para action=remove)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags para classificação do documento',
          },
          skipSecurity: {
            type: 'boolean',
            description: 'Pular análise de segurança/PII (padrão: false)',
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

    const { action, filePath, fileHash, tags, skipSecurity } = args;

    try {
      const indexer = new RagIndexer();

      if (action === 'index') {
        if (!filePath) return this.error('filePath é obrigatório para action=index');

        const result = await indexer.indexFile(filePath, {
          tags: tags ?? [],
          skipSecurity: skipSecurity ?? false,
        });

        if (result.success) {
          const warnings = result.errors?.length ? `\n⚠️ Avisos: ${result.errors.join('; ')}` : '';
          return this.success(
            `✅ Documento indexado com sucesso!\n` +
            `📄 Arquivo: ${filePath}\n` +
            `🔑 Hash: ${result.fileHash}\n` +
            `📦 Chunks: ${result.chunksIndexed}\n` +
            `🔒 Segurança: ${result.securityLevel ?? 'internal'}\n` +
            `👤 PII detectados: ${result.piiCount ?? 0}` +
            warnings,
            { fileHash: result.fileHash, chunksIndexed: result.chunksIndexed }
          );
        } else {
          return this.error(`Falha ao indexar: ${result.errors?.join('; ')}`);
        }
      }

      if (action === 'remove') {
        if (!fileHash) return this.error('fileHash é obrigatório para action=remove');
        await indexer.removeFile(fileHash);
        return this.success(`✅ Documento ${fileHash} removido do índice RAG.`);
      }

      return this.error(`Ação desconhecida: ${action}`);
    } catch (err: any) {
      return this.error(`Erro na operação RAG: ${err.message}`);
    }
  }
}
