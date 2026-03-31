import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Database Singleton - Manages SQLite connection with WAL mode
 * Note: For full database encryption, consider using @journeyapps/sqlcipher
 * Currently using field-level encryption for sensitive data
 */
export class DatabaseConnection {
  private static instance: Database.Database | null = null;
  private static readonly DB_PATH = process.env.DATABASE_PATH || './data/gueclaw.db';
  private static encryptionKey: Buffer | null = null;

  private constructor() {}

  /**
   * Encrypt sensitive field data using AES-256-GCM
   */
  public static encryptField(plaintext: string): Buffer {
    if (!DatabaseConnection.encryptionKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY not configured');
    }
    
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', DatabaseConnection.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Return: IV (12) + AuthTag (16) + Encrypted
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt sensitive field data
   */
  public static decryptField(ciphertext: Buffer): string {
    if (!DatabaseConnection.encryptionKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY not configured');
    }
    
    const iv = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(12, 28);
    const encrypted = ciphertext.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', DatabaseConnection.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  public static getInstance(): Database.Database {
    if (!DatabaseConnection.instance) {
      // Ensure data directory exists
      const dbDir = path.dirname(DatabaseConnection.DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize encryption key if provided
      const encKeyHex = process.env.DATABASE_ENCRYPTION_KEY;
      if (encKeyHex) {
        DatabaseConnection.encryptionKey = Buffer.from(encKeyHex, 'hex');
        console.log('🔐 Field-level encryption enabled (AES-256-GCM)');
      } else {
        console.warn('⚠️  WARNING: DATABASE_ENCRYPTION_KEY not set - sensitive fields are NOT encrypted!');
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

    // Execution traces for debug API
    db.exec(`
      CREATE TABLE IF NOT EXISTS execution_traces (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id TEXT,
        iteration INTEGER NOT NULL,
        tool_name TEXT,
        tool_args TEXT,
        tool_result TEXT,
        thought TEXT,
        tokens_used INTEGER,
        finish_reason TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Financial transactions (Personal Finance Control)
    db.exec(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        transaction_date INTEGER NOT NULL,
        amount_encrypted BLOB NOT NULL,
        description_encrypted BLOB NOT NULL,
        cost_center TEXT NOT NULL,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('entrada', 'saida')),
        movement_type TEXT NOT NULL CHECK(movement_type IN ('parcela', 'unico', 'mensal')),
        installment_info TEXT,
        status TEXT NOT NULL CHECK(status IN ('realizado', 'nao_realizado')) DEFAULT 'nao_realizado',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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

      CREATE INDEX IF NOT EXISTS idx_traces_conversation
      ON execution_traces(conversation_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_financial_user_date
      ON financial_transactions(user_id, transaction_date DESC);

      CREATE INDEX IF NOT EXISTS idx_financial_user_status
      ON financial_transactions(user_id, status, transaction_date DESC);
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
