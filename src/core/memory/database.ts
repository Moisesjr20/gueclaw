import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Database Singleton - Manages SQLite connection with WAL mode
 */
export class DatabaseConnection {
  private static instance: Database.Database | null = null;
  private static readonly DB_PATH = process.env.DATABASE_PATH || './data/gueclaw.db';

  private constructor() {}

  public static getInstance(): Database.Database {
    if (!DatabaseConnection.instance) {
      // Ensure data directory exists
      const dbDir = path.dirname(DatabaseConnection.DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection
      DatabaseConnection.instance = new Database(DatabaseConnection.DB_PATH);

      // Enable WAL mode for better concurrency
      if (process.env.ENABLE_WAL === 'true') {
        DatabaseConnection.instance.pragma('journal_mode = WAL');
      }

      // Initialize schema
      DatabaseConnection.initializeSchema();

      console.log(`✅ Database connected at ${DatabaseConnection.DB_PATH}`);
    }

    return DatabaseConnection.instance;
  }

  private static initializeSchema(): void {
    const db = DatabaseConnection.instance!;

    // Conversations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Messages table
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
        content TEXT NOT NULL,
        timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // Skills execution history
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_executions (
        id TEXT PRIMARY KEY,
        skill_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        execution_time_ms INTEGER,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_conversations_user 
      ON conversations(user_id, updated_at);
      
      CREATE INDEX IF NOT EXISTS idx_skill_executions_user 
      ON skill_executions(user_id, timestamp);
    `);

    console.log('📊 Database schema initialized');
  }

  public static close(): void {
    if (DatabaseConnection.instance) {
      DatabaseConnection.instance.close();
      DatabaseConnection.instance = null;
      console.log('🔌 Database connection closed');
    }
  }
}
