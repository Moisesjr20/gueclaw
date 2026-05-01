import { Pool, PoolConfig } from 'pg';

/**
 * Vector Database Connection (PostgreSQL + pgvector)
 * Used for RAG (Retrieval-Augmented Generation) and semantic memory
 */
export class VectorDatabase {
  private static instance: Pool | null = null;
  
  private static readonly config: PoolConfig = {
    host: process.env.MAYAN_DB_HOST || 'localhost',
    port: parseInt(process.env.MAYAN_DB_PORT || '5432', 10),
    database: process.env.MAYAN_DB_NAME || 'mayan',
    user: process.env.MAYAN_DB_USER || 'mayan',
    password: process.env.MAYAN_DB_PASSWORD || 'mayan_secure_password_2026',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  public static getInstance(): Pool {
    if (!VectorDatabase.instance) {
      VectorDatabase.instance = new Pool(VectorDatabase.config);
      
      VectorDatabase.instance.on('error', (err) => {
        console.error('❌ Unexpected error on idle PostgreSQL client', err);
      });

      console.log('🐘 PostgreSQL Vector Database pool created');
      
      // Initialize vector extension and tables
      VectorDatabase.initialize().catch(err => {
        console.error('❌ Failed to initialize vector database:', err);
      });
    }
    return VectorDatabase.instance;
  }

  /**
   * Initialize pgvector extension and RAG tables
   */
  private static async initialize(): Promise<void> {
    const pool = VectorDatabase.instance!;
    const client = await pool.connect();
    
    try {
      console.log('🛡️  Initializing Vector Database schema...');
      
      // 1. Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // 2. Create semantic_memory table
      // dimension 768 is for Google's embedding-001 model
      await client.query(`
        CREATE TABLE IF NOT EXISTS semantic_memory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          embedding vector(768),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Create index for vector similarity search (IVFFlat)
      // Note: For larger datasets, HNSW index is better but slower to build
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding 
        ON semantic_memory USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

      console.log('✅ Vector Database schema initialized (pgvector)');
    } finally {
      client.release();
    }
  }

  /**
   * Close the pool
   */
  public static async close(): Promise<void> {
    if (VectorDatabase.instance) {
      await VectorDatabase.instance.end();
      VectorDatabase.instance = null;
      console.log('🔌 PostgreSQL connection closed');
    }
  }
}
