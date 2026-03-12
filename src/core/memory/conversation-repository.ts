import { DatabaseConnection } from './database';
import { Conversation, Message } from '../../types';
import { randomUUID } from 'crypto';

/**
 * Repository for managing conversations in the database
 */
export class ConversationRepository {
  private db = DatabaseConnection.getInstance();

  /**
   * Create or get existing conversation for a user
   */
  public getOrCreate(userId: string, provider: string = 'deepseek'): Conversation {
    // Try to get the most recent conversation
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);

    let conversation = stmt.get(userId) as Conversation | undefined;

    if (!conversation) {
      // Create new conversation
      const id = randomUUID();
      const insertStmt = this.db.prepare(`
        INSERT INTO conversations (id, user_id, provider)
        VALUES (?, ?, ?)
      `);

      insertStmt.run(id, userId, provider);

      conversation = {
        id,
        userId,
        provider,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return conversation;
  }

  /**
   * Update conversation timestamp
   */
  public touch(conversationId: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);

    stmt.run(conversationId);
  }

  /**
   * Get conversation by ID
   */
  public getById(conversationId: string): Conversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(conversationId) as Conversation | undefined;
  }

  /**
   * Delete old conversations (cleanup)
   */
  public deleteOlderThan(daysOld: number): number {
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);
    
    const stmt = this.db.prepare(`
      DELETE FROM conversations 
      WHERE updated_at < ?
    `);

    const result = stmt.run(cutoffTimestamp);
    return result.changes;
  }
}
