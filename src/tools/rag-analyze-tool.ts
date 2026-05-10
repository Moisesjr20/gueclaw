import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { RagDatabase } from '../services/rag/rag-database';
import { RagSearcher } from '../services/rag/rag-searcher';

export class RagAnalyzeTool extends BaseTool {
  public readonly name = 'rag_analyze';
  public readonly description = `Busca contexto relevante no RAG e retorna os trechos prontos para serem injetados
no prompt de análise. Use quando precisar fundamentar uma resposta com conteúdo de documentos indexados.

Diferente de rag_search (que exibe resultados), rag_analyze retorna o contexto já formatado para uso
em prompts de LLM, incluindo metadados de proveniência.

Exemplo:
{"question":"Quais são as obrigações do contratante conforme os documentos?","maxChunks":4}`;

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pergunta ou tema a analisar nos documentos',
          },
          maxChunks: {
            type: 'number',
            description: 'Número máximo de trechos de contexto (padrão: 4)',
          },
          minSimilarity: {
            type: 'number',
            description: 'Score mínimo de similaridade 0-1 (padrão: 0.4)',
          },
        },
        required: ['question'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (!RagDatabase.getInstance().isConnected()) {
      return this.error('RAG database não está conectado. Configure RAG_POSTGRES_URL no .env');
    }

    const { question, maxChunks = 4, minSimilarity = 0.4 } = args;

    if (!question?.trim()) return this.error('question não pode ser vazia');

    try {
      const searcher = new RagSearcher();
      const results = await searcher.search(question, maxChunks + 3);

      const relevant = results.filter(r => r.similarity >= minSimilarity).slice(0, maxChunks);

      if (relevant.length === 0) {
        return this.success(
          'Nenhum contexto relevante encontrado nos documentos indexados para essa pergunta.\n' +
          'Responda com base no seu conhecimento geral ou peça mais informações ao usuário.',
          { contextFound: false }
        );
      }

      const contextBlocks = relevant.map(({ chunk, similarity, document }, i) => {
        const simPct = (similarity * 100).toFixed(0);
        return (
          `[Fonte ${i + 1}: ${document.originalFilename}, chunk ${chunk.chunkIndex}, ${simPct}% relevância]\n` +
          chunk.content.trim()
        );
      });

      const context =
        `=== CONTEXTO DOS DOCUMENTOS ===\n\n` +
        contextBlocks.join('\n\n---\n\n') +
        `\n\n=== FIM DO CONTEXTO ===\n\n` +
        `Com base APENAS no contexto acima, responda: ${question}`;

      return this.success(context, {
        contextFound: true,
        chunksUsed: relevant.length,
        sources: relevant.map(r => r.document.originalFilename),
      });
    } catch (err: any) {
      return this.error(`Erro ao buscar contexto RAG: ${err.message}`);
    }
  }
}
