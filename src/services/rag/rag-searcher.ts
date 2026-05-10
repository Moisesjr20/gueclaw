import OpenAI from 'openai';
import { RagDatabase } from './rag-database';
import { RagDocument, RagChunk, RagSearchResult, SearchFilters } from './rag-types';

export class RagSearcher {
  private db: RagDatabase;
  private openai: OpenAI;
  private embeddingModel: string;
  private defaultTopK: number;

  constructor() {
    this.db = RagDatabase.getInstance();

    this.openai = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
    });

    this.embeddingModel = process.env.RAG_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
    this.defaultTopK = parseInt(process.env.RAG_TOP_K || '5', 10);
  }

  async search(query: string, topK?: number): Promise<RagSearchResult[]> {
    const k = topK ?? this.defaultTopK;
    const pool = this.db.getPool();

    const queryEmbedding = await this.generateEmbedding(query);
    const vecLiteral = `[${queryEmbedding.join(',')}]`;

    const result = await pool.query(`
      SELECT
        c.id, c.file_hash, c.file_path, c.chunk_index, c.content,
        c.metadata, c.indexed_at,
        1 - (c.embedding <=> $1::vector) AS similarity,
        m.id           AS doc_id,
        m.original_filename,
        m.stored_path,
        m.file_size_bytes,
        m.tags,
        m.security_level,
        m.pii_count,
        m.indexed_at   AS doc_indexed_at,
        m.updated_at
      FROM document_chunks c
      JOIN document_metadata m ON c.file_hash = m.file_hash
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
    `, [vecLiteral, k]);

    return result.rows.map(row => ({
      chunk: {
        id: row.id,
        fileHash: row.file_hash,
        filePath: row.file_path,
        chunkIndex: row.chunk_index,
        content: row.content,
        metadata: row.metadata ?? {},
        indexedAt: row.indexed_at,
      } as RagChunk,
      similarity: parseFloat(row.similarity),
      document: this.rowToDocument(row),
    }));
  }

  async getDocument(fileHash: string): Promise<RagDocument | null> {
    const pool = this.db.getPool();
    const result = await pool.query(
      'SELECT * FROM document_metadata WHERE file_hash = $1',
      [fileHash]
    );
    return result.rows.length ? this.rowToDocument(result.rows[0]) : null;
  }

  async listDocuments(filters?: SearchFilters): Promise<RagDocument[]> {
    const pool = this.db.getPool();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.tags?.length) {
      params.push(filters.tags);
      conditions.push(`tags && $${params.length}`);
    }
    if (filters?.securityLevel) {
      params.push(filters.securityLevel);
      conditions.push(`security_level = $${params.length}`);
    }
    if (filters?.filename) {
      params.push(`%${filters.filename}%`);
      conditions.push(`original_filename ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM document_metadata ${where} ORDER BY indexed_at DESC`,
      params
    );

    return result.rows.map(row => this.rowToDocument(row));
  }

  private rowToDocument(row: any): RagDocument {
    return {
      id: row.doc_id ?? row.id,
      fileHash: row.file_hash,
      originalFilename: row.original_filename,
      storedPath: row.stored_path,
      fileSizeBytes: row.file_size_bytes,
      tags: row.tags ?? [],
      securityLevel: row.security_level,
      piiCount: row.pii_count,
      indexedAt: row.doc_indexed_at ?? row.indexed_at,
      updatedAt: row.updated_at,
    };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }
}
