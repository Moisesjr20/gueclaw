import { GoogleGenerativeAI } from '@google/generative-ai';
import { VectorDatabase } from '../core/memory/vector-database';

/**
 * RAG Service (Retrieval-Augmented Generation)
 * Handles embeddings and semantic search using pgvector
 */
export class RAGService {
  private static instance: RAGService;
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
  }

  public static getInstance(): RAGService {
    if (!RAGService.instance) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for RAG features');
      }
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  /**
   * Generate embedding for a given text
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error: any) {
      console.error('❌ Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Store a piece of text in the semantic memory
   */
  public async storeMemory(userId: string, content: string, metadata: any = {}): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    const pool = VectorDatabase.getInstance();
    
    try {
      await pool.query(
        'INSERT INTO semantic_memory (user_id, content, embedding, metadata) VALUES ($1, $2, $3, $4)',
        [userId, content, JSON.stringify(embedding), JSON.stringify(metadata)]
      );
      console.log('🧠 Memory stored semanticly');
    } catch (error: any) {
      console.error('❌ Error storing semantic memory:', error.message);
    }
  }

  /**
   * Search for relevant memories based on a query
   */
  public async searchMemories(userId: string, query: string, limit: number = 5): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const pool = VectorDatabase.getInstance();
    
    try {
      // Use pgvector cosine distance operator <=>
      const result = await pool.query(
        `SELECT content, metadata, 1 - (embedding <=> $1) as similarity 
         FROM semantic_memory 
         WHERE user_id = $2 
         ORDER BY embedding <=> $1 
         LIMIT $3`,
        [JSON.stringify(queryEmbedding), userId, limit]
      );
      
      return result.rows;
    } catch (error: any) {
      console.error('❌ Error searching semantic memory:', error.message);
      return [];
    }
  }
}
