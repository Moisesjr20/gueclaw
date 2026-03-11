import Database, { Database as IDatabase } from 'better-sqlite3';
import * as path from 'path';
import { Conversation, Message } from './entities';
import * as crypto from 'crypto';

export type SubAgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SubAgent {
  id: string;
  name: string;
  created_by: string;
  status: SubAgentStatus;
  created_at: number;
}

export interface SubAgentRun {
  id: number;
  sub_agent_id: string;
  task: string;
  result: string | null;
  status: SubAgentStatus;
  started_at: number;
  finished_at: number | null;
  error: string | null;
}

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

      CREATE TABLE IF NOT EXISTS sub_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sub_agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sub_agent_id TEXT NOT NULL,
        task TEXT NOT NULL,
        result TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        error TEXT,
        FOREIGN KEY (sub_agent_id) REFERENCES sub_agents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_runs_agent ON sub_agent_runs(sub_agent_id);
    `);
  }

  // ────────────────────────────────────────────────────────────
  // Sub-Agent CRUD
  // ────────────────────────────────────────────────────────────

  public createSubAgent(id: string, name: string, createdBy: string): SubAgent {
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO sub_agents (id, name, created_by, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, createdBy, 'pending', now);
    return { id, name, created_by: createdBy, status: 'pending', created_at: now };
  }

  public updateSubAgentStatus(id: string, status: SubAgentStatus): void {
    this.db.prepare('UPDATE sub_agents SET status = ? WHERE id = ?').run(status, id);
  }

  public getAllSubAgents(): SubAgent[] {
    return this.db.prepare('SELECT * FROM sub_agents ORDER BY created_at DESC').all() as SubAgent[];
  }

  public getSubAgentById(id: string): SubAgent | null {
    return (this.db.prepare('SELECT * FROM sub_agents WHERE id = ?').get(id) as SubAgent) ?? null;
  }

  // ────────────────────────────────────────────────────────────
  // Sub-Agent Run CRUD
  // ────────────────────────────────────────────────────────────

  public createSubAgentRun(subAgentId: string, task: string): number {
    const now = Date.now();
    const info = this.db.prepare(
      'INSERT INTO sub_agent_runs (sub_agent_id, task, status, started_at) VALUES (?, ?, ?, ?)'
    ).run(subAgentId, task, 'running', now);
    return info.lastInsertRowid as number;
  }

  public finishSubAgentRun(runId: number, status: SubAgentStatus, result?: string, error?: string): void {
    this.db.prepare(
      'UPDATE sub_agent_runs SET status = ?, result = ?, error = ?, finished_at = ? WHERE id = ?'
    ).run(status, result ?? null, error ?? null, Date.now(), runId);
  }

  public getSubAgentRuns(subAgentId: string, limit = 20): SubAgentRun[] {
    return this.db.prepare(
      'SELECT * FROM sub_agent_runs WHERE sub_agent_id = ? ORDER BY started_at DESC LIMIT ?'
    ).all(subAgentId, limit) as SubAgentRun[];
  }

  public getAllRuns(limit = 50): SubAgentRun[] {
    return this.db.prepare(
      'SELECT * FROM sub_agent_runs ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as SubAgentRun[];
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
