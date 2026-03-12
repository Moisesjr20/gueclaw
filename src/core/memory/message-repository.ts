import { DatabaseConnection } from './database';
import { Message } from '../../types';
import { randomUUID } from 'crypto';

/**
 * Repository for managing messages in conversations
 */
export class MessageRepository {
  private db = DatabaseConnection.getInstance();

  /**
   * Add a message to a conversation
   */
  public add(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const id = randomUUID();
    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const metadataJson = message.metadata ? JSON.stringify(message.metadata) : null;

    stmt.run(
      id,
      message.conversationId,
      message.role,
      message.content,
      Math.floor(timestamp / 1000),
      metadataJson
    );

    return {
      ...message,
      id,
      timestamp,
    };
  }

  /**
   * Get recent messages from a conversation with window limit
   */
  public getRecent(conversationId: string, limit: number = 10): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(conversationId, limit) as any[];

    return rows.reverse().map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp * 1000,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Get all messages from a conversation
   */
  public getAll(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(conversationId) as any[];

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp * 1000,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Delete all messages from a conversation
   */
  public deleteByConversation(conversationId: string): number {
    const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    const result = stmt.run(conversationId);
    return result.changes;
  }

  /**
   * Count messages in a conversation
   */
  public count(conversationId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
    `);
    const result = stmt.get(conversationId) as { count: number };
    return result.count;
  }
}
