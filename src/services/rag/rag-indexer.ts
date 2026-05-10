import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { RagDatabase } from './rag-database';
import { DocumentSecurityAnalyzer } from '../document-security-analyzer';
import { IndexingOptions, IndexingResult } from './rag-types';

export class RagIndexer {
  private db: RagDatabase;
  private securityAnalyzer: DocumentSecurityAnalyzer;
  private openai: OpenAI;
  private embeddingModel: string;
  private documentsDir: string;
  private chunkSizeChars: number;
  private chunkOverlapChars: number;

  constructor() {
    this.db = RagDatabase.getInstance();
    this.securityAnalyzer = new DocumentSecurityAnalyzer();

    this.openai = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
    });

    this.embeddingModel = process.env.RAG_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
    this.documentsDir = process.env.RAG_DOCUMENTS_DIR || './data/documents';

    // ~500 tokens × 4 chars/token
    this.chunkSizeChars = parseInt(process.env.RAG_CHUNK_SIZE || '500', 10) * 4;
    this.chunkOverlapChars = parseInt(process.env.RAG_CHUNK_OVERLAP || '50', 10) * 4;
  }

  async indexFile(filePath: string, options: IndexingOptions = {}): Promise<IndexingResult> {
    const errors: string[] = [];

    try {
      const absolutePath = path.resolve(filePath);
      if (!fs.existsSync(absolutePath)) {
        return { success: false, fileHash: '', chunksIndexed: 0, storedPath: '', errors: [`File not found: ${filePath}`] };
      }

      const fileBuffer = fs.readFileSync(absolutePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const filename = path.basename(absolutePath);
      const ext = path.extname(filename).toLowerCase();

      // Extract text
      let text = '';
      if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        text = pdfData.text;
      } else {
        text = fileBuffer.toString('utf-8');
      }

      if (!text.trim()) {
        return { success: false, fileHash, chunksIndexed: 0, storedPath: '', errors: ['No text content could be extracted'] };
      }

      // Security analysis (regex-only — no AI dependency)
      let securityLevel = 'internal';
      let piiCount = 0;
      if (!options.skipSecurity) {
        try {
          const analysis = await this.securityAnalyzer.analyze(text);
          securityLevel = analysis.classification.level;
          piiCount = analysis.piiDetections.length;
        } catch (e) {
          errors.push(`Security analysis skipped: ${e}`);
        }
      }

      // Store original file under data/documents/YYYY-MM/
      const datePart = new Date().toISOString().slice(0, 7);
      const destDir = path.join(this.documentsDir, datePart);
      fs.mkdirSync(destDir, { recursive: true });
      const storedPath = path.join(destDir, `${fileHash.slice(0, 8)}_${filename}`);
      fs.copyFileSync(absolutePath, storedPath);

      const pool = this.db.getPool();

      // Upsert metadata (chunks FK depends on this row existing first)
      await pool.query(`
        INSERT INTO document_metadata
          (file_hash, original_filename, stored_path, file_size_bytes, tags, security_level, pii_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (file_hash) DO UPDATE SET
          original_filename = EXCLUDED.original_filename,
          stored_path       = EXCLUDED.stored_path,
          tags              = EXCLUDED.tags,
          security_level    = EXCLUDED.security_level,
          pii_count         = EXCLUDED.pii_count,
          updated_at        = NOW()
      `, [fileHash, filename, storedPath, fileBuffer.length, options.tags ?? [], securityLevel, piiCount]);

      // Remove stale chunks before re-indexing
      await pool.query('DELETE FROM document_chunks WHERE file_hash = $1', [fileHash]);

      const chunks = this.chunkText(text);
      let chunksIndexed = 0;

      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await this.generateEmbedding(chunks[i]);
          const vecLiteral = `[${embedding.join(',')}]`;

          await pool.query(`
            INSERT INTO document_chunks
              (file_hash, file_path, chunk_index, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5::vector, $6)
            ON CONFLICT (file_hash, chunk_index) DO UPDATE SET
              content   = EXCLUDED.content,
              embedding = EXCLUDED.embedding
          `, [fileHash, storedPath, i, chunks[i], vecLiteral, JSON.stringify({ filename, tags: options.tags ?? [] })]);

          chunksIndexed++;
        } catch (e) {
          errors.push(`Chunk ${i} failed: ${e}`);
        }
      }

      return {
        success: chunksIndexed > 0,
        fileHash,
        chunksIndexed,
        storedPath,
        securityLevel,
        piiCount,
        errors: errors.length ? errors : undefined,
      };

    } catch (error: any) {
      return { success: false, fileHash: '', chunksIndexed: 0, storedPath: '', errors: [error.message] };
    }
  }

  async removeFile(fileHash: string): Promise<void> {
    const pool = this.db.getPool();
    // Chunks deleted via CASCADE on document_metadata
    await pool.query('DELETE FROM document_metadata WHERE file_hash = $1', [fileHash]);
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    let current = '';

    for (const para of paragraphs) {
      const candidate = current ? `${current}\n\n${para}` : para;

      if (candidate.length <= this.chunkSizeChars) {
        current = candidate;
      } else {
        if (current) chunks.push(current.trim());

        if (para.length > this.chunkSizeChars) {
          for (let i = 0; i < para.length; i += this.chunkSizeChars - this.chunkOverlapChars) {
            const slice = para.slice(i, i + this.chunkSizeChars).trim();
            if (slice) chunks.push(slice);
          }
          current = '';
        } else {
          current = para;
        }
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(c => c.length > 10);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }
}
