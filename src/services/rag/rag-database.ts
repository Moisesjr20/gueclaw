import { Pool, PoolClient } from 'pg';

export class RagDatabase {
  private static instance: RagDatabase | null = null;
  private pool: Pool | null = null;

  private constructor() {}

  static getInstance(): RagDatabase {
    if (!RagDatabase.instance) {
      RagDatabase.instance = new RagDatabase();
    }
    return RagDatabase.instance;
  }

  async connect(): Promise<void> {
    const connectionString = process.env.RAG_POSTGRES_URL;
    if (!connectionString) {
      throw new Error('RAG_POSTGRES_URL not configured — skipping RAG database');
    }

    this.pool = new Pool({ connectionString, max: 5 });

    const client = await this.pool.connect();
    try {
      await this.initSchema(client);
      console.log('✅ RAG Database connected');
    } finally {
      client.release();
    }
  }

  private async initSchema(client: PoolClient): Promise<void> {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id               SERIAL PRIMARY KEY,
        file_hash        TEXT UNIQUE NOT NULL,
        original_filename TEXT NOT NULL,
        stored_path      TEXT NOT NULL,
        file_size_bytes  INTEGER DEFAULT 0,
        tags             TEXT[] DEFAULT '{}',
        security_level   TEXT DEFAULT 'internal',
        pii_count        INTEGER DEFAULT 0,
        indexed_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id          SERIAL PRIMARY KEY,
        file_hash   TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content     TEXT NOT NULL,
        embedding   vector(1536),
        metadata    JSONB DEFAULT '{}'::jsonb,
        indexed_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(file_hash, chunk_index),
        FOREIGN KEY (file_hash) REFERENCES document_metadata(file_hash) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chunks_file_hash
        ON document_chunks(file_hash)
    `);

    console.log('📊 RAG schema initialized');
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('RagDatabase not connected. Call connect() first.');
    }
    return this.pool;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔌 RAG Database closed');
    }
  }
}
