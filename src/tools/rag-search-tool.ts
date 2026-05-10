import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { RagDatabase } from '../services/rag/rag-database';
import { RagSearcher } from '../services/rag/rag-searcher';

export class RagSearchTool extends BaseTool {
  public readonly name = 'rag_search';
  public readonly description = `Busca semântica em documentos indexados no RAG (PostgreSQL + pgvector).
Retorna os trechos mais relevantes com score de similaridade e metadados do documento.

Exemplos:
{"query":"quais foram as despesas de marketing em março","topK":5}
{"query":"cláusula de rescisão contratual","topK":3,"tags":["contratos"]}`;

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto da consulta em linguagem natural',
          },
          topK: {
            type: 'number',
            description: 'Número máximo de resultados (padrão: 5)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filtrar por tags específicas',
          },
          filename: {
            type: 'string',
            description: 'Filtrar por nome de arquivo (parcial)',
          },
          securityLevel: {
            type: 'string',
            enum: ['public', 'internal', 'confidential', 'secret'],
            description: 'Filtrar por nível de segurança',
          },
          minSimilarity: {
            type: 'number',
            description: 'Score mínimo de similaridade 0-1 (padrão: 0.3)',
          },
        },
        required: ['query'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (!RagDatabase.getInstance().isConnected()) {
      return this.error('RAG database não está conectado. Configure RAG_POSTGRES_URL no .env');
    }

    const { query, topK, tags, filename, securityLevel, minSimilarity = 0.3 } = args;

    if (!query?.trim()) return this.error('query não pode ser vazia');

    try {
      const searcher = new RagSearcher();
      const results = await searcher.search(query, topK);

      const filtered = results.filter(r => r.similarity >= minSimilarity);

      if (filtered.length === 0) {
        return this.success('🔍 Nenhum documento relevante encontrado para a consulta.', { count: 0 });
      }

      const lines: string[] = [`🔍 **${filtered.length} resultado(s) encontrado(s):**\n`];

      for (let i = 0; i < filtered.length; i++) {
        const { chunk, similarity, document } = filtered[i];
        const simPct = (similarity * 100).toFixed(1);
        lines.push(
          `---\n` +
          `**[${i + 1}] ${document.originalFilename}** (${simPct}% relevância)\n` +
          `🔒 ${document.securityLevel} | 🏷️ ${document.tags.join(', ') || 'sem tags'} | Chunk #${chunk.chunkIndex}\n` +
          `\n${chunk.content.slice(0, 600)}${chunk.content.length > 600 ? '…' : ''}\n`
        );
      }

      return this.success(lines.join('\n'), {
        count: filtered.length,
        topSimilarity: filtered[0].similarity,
      });
    } catch (err: any) {
      return this.error(`Erro na busca RAG: ${err.message}`);
    }
  }
}
