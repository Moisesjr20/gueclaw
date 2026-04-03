import { DatabaseConnection } from '../../core/memory/database';
import { ExtractedMemory, MemoryQuery, MemoryStats, MemoryType, MemoryImportance } from './types';
import Database from 'better-sqlite3';

/**
 * Repository for managing extracted memories in SQLite
 */
export class MemoryRepository {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.initializeSchema();
  }

  /**
   * Initialize the extracted_memories table
   */
  private initializeSchema(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS extracted_memories (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT,
        importance TEXT NOT NULL,
        confidence REAL NOT NULL,
        source_message_ids TEXT NOT NULL,
        tags TEXT NOT NULL,
        extracted_at INTEGER NOT NULL,
        expires_at INTEGER,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON extracted_memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_conversation_id ON extracted_memories(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON extracted_memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON extracted_memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_extracted_at ON extracted_memories(extracted_at);
      CREATE INDEX IF NOT EXISTS idx_memories_expires_at ON extracted_memories(expires_at);
    `;

    this.db.exec(createTableSQL);
    this.db.exec(createIndexes);
  }

  /**
   * Add a new extracted memory
   */
  public add(memory: ExtractedMemory): ExtractedMemory {
    const id = memory.id || this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO extracted_memories (
        id, conversation_id, user_id, type, content, context,
        importance, confidence, source_message_ids, tags,
        extracted_at, expires_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.conversationId,
      memory.userId,
      memory.type,
      memory.content,
      memory.context || null,
      memory.importance,
      memory.confidence,
      JSON.stringify(memory.sourceMessageIds),
      JSON.stringify(memory.tags),
      memory.extractedAt || now,
      memory.expiresAt || null,
      memory.metadata ? JSON.stringify(memory.metadata) : null
    );

    return { ...memory, id };
  }

  /**
   * Query memories with filters
   */
  public query(query: MemoryQuery): ExtractedMemory[] {
    const conditions: string[] = [];
    const params: any[] = [];

    // Build WHERE clause
    if (query.userId) {
      conditions.push('user_id = ?');
      params.push(query.userId);
    }

    if (query.conversationId) {
      conditions.push('conversation_id = ?');
      params.push(query.conversationId);
    }

    if (query.types && query.types.length > 0) {
      conditions.push(`type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }

    if (query.importance && query.importance.length > 0) {
      conditions.push(`importance IN (${query.importance.map(() => '?').join(', ')})`);
      params.push(...query.importance);
    }

    if (query.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      params.push(query.minConfidence);
    }

    if (!query.includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > ?)');
      params.push(Date.now());
    }

    // Build query
    let sql = 'SELECT * FROM extracted_memories';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY importance DESC, confidence DESC, extracted_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToMemory);
  }

  /**
   * Get all memories for a user
   */
  public getByUser(userId: string, limit?: number): ExtractedMemory[] {
    return this.query({ userId, limit, includeExpired: false });
  }

  /**
   * Get memories by conversation
   */
  public getByConversation(conversationId: string): ExtractedMemory[] {
    return this.query({ conversationId, includeExpired: false });
  }

  /**
   * Get memories by type
   */
  public getByType(userId: string, type: MemoryType, limit?: number): ExtractedMemory[] {
    return this.query({ userId, types: [type], limit, includeExpired: false });
  }

  /**
   * Search memories by tags
   */
  public searchByTags(userId: string, tags: string[]): ExtractedMemory[] {
    // Simple tag search (can be optimized with FTS if needed)
    const allMemories = this.getByUser(userId);
    return allMemories.filter((m) =>
      tags.some((tag) => m.tags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Get memory statistics for a user
   */
  public getStats(userId: string): MemoryStats {
    const memories = this.getByUser(userId);

    const stats: MemoryStats = {
      totalMemories: memories.length,
      byType: {} as Record<MemoryType, number>,
      byImportance: {} as Record<MemoryImportance, number>,
      avgConfidence: 0,
      mostRecentExtraction: undefined,
    };

    if (memories.length === 0) return stats;

    // Count by type
    memories.forEach((m) => {
      stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;
      stats.byImportance[m.importance] = (stats.byImportance[m.importance] || 0) + 1;
    });

    // Average confidence
    stats.avgConfidence =
      memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;

    // Most recent extraction
    stats.mostRecentExtraction = Math.max(...memories.map((m) => m.extractedAt));

    return stats;
  }

  /**
   * Delete expired memories
   */
  public deleteExpired(): number {
    const stmt = this.db.prepare(`
      DELETE FROM extracted_memories 
      WHERE expires_at IS NOT NULL AND expires_at <= ?
    `);

    const result = stmt.run(Date.now());
    return result.changes;
  }

  /**
   * Delete memory by ID
   */
  public delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM extracted_memories WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all memories for a conversation
   */
  public deleteByConversation(conversationId: string): void {
    const stmt = this.db.prepare('DELETE FROM extracted_memories WHERE conversation_id = ?');
    stmt.run(conversationId);
  }

  /**
   * Delete all memories for a user
   */
  public deleteByUser(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM extracted_memories WHERE user_id = ?');
    stmt.run(userId);
  }

  /**
   * Convert database row to ExtractedMemory
   */
  private rowToMemory(row: any): ExtractedMemory {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      type: row.type as MemoryType,
      content: row.content,
      context: row.context || undefined,
      importance: row.importance as MemoryImportance,
      confidence: row.confidence,
      sourceMessageIds: JSON.parse(row.source_message_ids),
      tags: JSON.parse(row.tags),
      extractedAt: row.extracted_at,
      expiresAt: row.expires_at || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
