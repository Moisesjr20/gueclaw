import Database, { Database as IDatabase } from 'better-sqlite3';
import * as path from 'path';
import { Conversation, Message } from './entities';
import * as crypto from 'crypto';

export class MemoryManager {
  private db: IDatabase;

  constructor() {
    const dbPath = path.resolve(process.cwd(), 'data', 'db.sqlite');
    
    // Conecta e habilita WAL (Write-Ahead Logging) para melhor desempenho em I/O local
    this.db = new Database(dbPath, { verbose: console.log });
    this.db.pragma('journal_mode = WAL');
    
    this.initializeTables();
  }

  /**
   * Inicializa schema do banco
   */
  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    `);
  }

  /**
   * Busca ou cria a thread de conversa para um usuário.
   */
  public getOrCreateConversation(userId: string, provider: string): Conversation {
    const id = crypto.createHash('md5').update(userId).digest('hex'); // Hash simples para id = usuario no MVP

    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    let conv = stmt.get(id) as Conversation;

    if (!conv) {
      const insert = this.db.prepare(
        'INSERT INTO conversations (id, user_id, provider, created_at) VALUES (?, ?, ?, ?)'
      );
      const now = Date.now();
      insert.run(id, userId, provider, now);
      conv = { id, user_id: userId, provider, created_at: now };
    } else if (conv.provider !== provider) {
       // Atualiza provider pro mais recente (Gemin->Deepseek)
       const update = this.db.prepare('UPDATE conversations SET provider = ? WHERE id = ?');
       update.run(provider, id);
       conv.provider = provider;
    }

    return conv;
  }

  public saveMessage(conversationId: string, role: string, content: string) {
    const insert = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    );
    insert.run(conversationId, role, content, Date.now());
  }

  public getMessages(conversationId: string, limit: number = 20): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?' // ASC -> mais antigas p/ mais novas context
    );
    return stmt.all(conversationId, limit) as Message[];
  }
}
