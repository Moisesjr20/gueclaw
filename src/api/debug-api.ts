import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { DatabaseConnection } from '../core/memory/database';
import { TraceRepository } from './trace-repository';
import { FinancialRepository } from '../core/memory/financial-repository';
import { MemoryManager } from '../core/memory/memory-manager';
import { SkillLoader } from '../core/skills/skill-loader';
import { SkillRouter } from '../core/skills/skill-router';
import { SkillExecutor } from '../core/skills/skill-executor';
import { AgentLoop } from '../core/agent-loop/agent-loop';
import { ProviderFactory } from '../core/providers/provider-factory';
import { NO_REPLY } from '../types';

const DEFAULT_PORT = 3742;
const LOG_PATH = process.env.PM2_LOG_PATH || '/root/.pm2/logs/gueclaw-agent-out.log';
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || '';

const LEADS_DB_PATH = path.resolve(
  __dirname,
  '../../.agents/skills/whatsapp-leads-sender/data/leads.db',
);
const WORKER_STATE_PATH = path.resolve(
  __dirname,
  '../../.agents/skills/whatsapp-leads-sender/data/worker_state.json',
);

export class DebugAPI {
  private app = express();
  private traceRepo = TraceRepository.getInstance();
  private memoryManager: MemoryManager;
  private skillRouter: SkillRouter;
  private availableSkills: any[];

  constructor() {
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    this.availableSkills = SkillLoader.loadAll();
    this.app.use(express.json());

    // CORS — allow dashboard on Vercel
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
      if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
      next();
    });

    this.registerRoutes();
  }

  /** Middleware: validate x-api-key header (no-op if DASHBOARD_API_KEY is unset) */
  private auth() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!DASHBOARD_API_KEY) { next(); return; }
      if (req.headers['x-api-key'] === DASHBOARD_API_KEY) { next(); return; }
      res.status(401).json({ error: 'Unauthorized' });
    };
  }

  private registerRoutes(): void {
    // Health check (public — used by Vercel probe)
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ ok: true, ts: Date.now() });
    });

    // List recent conversations
    this.app.get('/api/conversations', this.auth(), (req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const userId = req.query.userId as string | undefined;

        let rows: any[];
        if (userId) {
          rows = db.prepare(`
            SELECT c.id, c.user_id, c.provider, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
            FROM conversations c
            WHERE c.user_id = ?
            ORDER BY c.updated_at DESC
            LIMIT ?
          `).all(userId, limit);
        } else {
          rows = db.prepare(`
            SELECT c.id, c.user_id, c.provider, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
            FROM conversations c
            ORDER BY c.updated_at DESC
            LIMIT ?
          `).all(limit);
        }

        res.json(rows);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Get messages for a conversation
    this.app.get('/api/conversations/:id/messages', this.auth(), (req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const limit = Math.min(Number(req.query.limit) || 50, 500);
        const convId = String(req.params.id);
        const rows = db.prepare(`
          SELECT id, conversation_id, role, content, timestamp, metadata
          FROM messages
          WHERE conversation_id = ?
          ORDER BY timestamp ASC
          LIMIT ?
        `).all(convId, limit) as any[];

        res.json(rows.map(r => ({
          ...r,
          metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        })));
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Get execution trace for a conversation
    this.app.get('/api/conversations/:id/trace', this.auth(), (req: Request, res: Response) => {
      try {
        const limit = Math.min(Number(req.query.limit) || 200, 1000);
        const convId = String(req.params.id);
        const traces = this.traceRepo.getByConversation(convId, limit);
        res.json(traces);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Delete a conversation and its traces
    this.app.delete('/api/conversations/:id', this.auth(), (req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const convId = String(req.params.id);
        db.prepare('DELETE FROM conversations WHERE id = ?').run(convId);
        this.traceRepo.deleteByConversation(convId);
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Tail PM2 logs
    this.app.get('/api/logs/tail', this.auth(), (req: Request, res: Response) => {
      try {
        const lines = Math.min(Number(req.query.lines) || 50, 500);
        if (!fs.existsSync(LOG_PATH)) {
          return res.status(404).json({ error: `Log file not found: ${LOG_PATH}` });
        }
        const content = fs.readFileSync(LOG_PATH, 'utf8');
        const all = content.split('\n');
        const tail = all.slice(Math.max(0, all.length - lines));
        res.json({ path: LOG_PATH, lines: tail });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // List available skills
    this.app.get('/api/skills', this.auth(), (_req: Request, res: Response) => {
      try {
        const skills = SkillLoader.loadAll();
        res.json(skills);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Chat — get messages for web interface
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/chat/messages/:id', this.auth(), (req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const convId = String(req.params.id);
        const rows = db.prepare(`
          SELECT 
            m.id, 
            m.role, 
            m.content, 
            m.timestamp as created_at,
            m.metadata
          FROM messages m
          WHERE m.conversation_id = ?
          ORDER BY m.timestamp ASC
        `).all(convId) as any[];

        // Get traces to identify tools used
        const traces = this.traceRepo.getByConversation(convId);
        const messageTraces = new Map<string, any[]>();
        
        traces.forEach(trace => {
          const msgId = `${convId}-${trace.iteration}`;
          if (!messageTraces.has(msgId)) {
            messageTraces.set(msgId, []);
          }
          if (trace.toolName) {
            messageTraces.get(msgId)!.push(trace.toolName);
          }
        });

        const formatted = rows.map((r, idx) => {
          const msgId = `${convId}-${idx}`;
          const tools = messageTraces.get(msgId) || [];
          const metadata = r.metadata ? JSON.parse(r.metadata) : {};
          
          return {
            id: r.id,
            role: r.role,
            content: r.content,
            created_at: r.created_at,
            tool_calls: tools.length > 0 ? Array.from(new Set(tools)) : undefined,
            skill_used: metadata.skill_name || undefined,
          };
        });

        res.json(formatted);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Chat — send message (web interface)
    // ──────────────────────────────────────────────────────────
    this.app.post('/api/chat', this.auth(), async (req: Request, res: Response) => {
      const { userId = 'dashboard-user', message, provider: providerName } = req.body as { 
        userId?: string; 
        message: string;
        provider?: string;
      };
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const startMs = Date.now();
      try {
        const conversation = this.memoryManager.getConversation(userId, providerName || 'dashboard');
        this.memoryManager.addUserMessage(conversation.id, message);
        const history = this.memoryManager.getRecentMessages(conversation.id);

        const enrichment = this.buildEnrichment(userId);
        const skillName = await this.skillRouter.route(message, this.availableSkills);
        let response: string;

        if (skillName && SkillLoader.skillExists(skillName)) {
          response = await SkillExecutor.executeAuto(skillName, message, history, enrichment, conversation.id);
        } else {
          const provider = ProviderFactory.getFastProvider();
          const agentLoop = new AgentLoop(provider, history, undefined, enrichment, undefined, conversation.id);
          response = await agentLoop.run(message);
        }

        if (response !== NO_REPLY) {
          this.memoryManager.addAssistantMessage(conversation.id, response);
        }

        const traces = this.traceRepo.getByConversation(conversation.id);
        const durationMs = Date.now() - startMs;

        res.status(201).json({
          conversationId: conversation.id,
          userId,
          skillRouted: skillName || null,
          response: response === NO_REPLY ? '[NO_REPLY - delivered via tool]' : response,
          durationMs,
          iterations: traces.length > 0 ? Math.max(...traces.map(t => t.iteration)) : 0,
          trace: traces.slice(-10), // Last 10 traces only
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message, durationMs: Date.now() - startMs });
      }
    });

    // Simulate a message (bypasses Telegram, returns full diagnostic)
    this.app.post('/api/simulate', this.auth(), async (req: Request, res: Response) => {
      const { userId = 'debug-user', input } = req.body as { userId?: string; input: string };
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'input is required' });
      }

      const startMs = Date.now();
      try {
        const conversation = this.memoryManager.getConversation(userId);
        this.memoryManager.addUserMessage(conversation.id, input);
        const history = this.memoryManager.getRecentMessages(conversation.id);

        const enrichment = this.buildEnrichment(userId);
        const skillName = await this.skillRouter.route(input, this.availableSkills);
        let response: string;

        if (skillName && SkillLoader.skillExists(skillName)) {
          response = await SkillExecutor.executeAuto(skillName, input, history, enrichment, conversation.id);
        } else {
          const provider = ProviderFactory.getFastProvider();
          const agentLoop = new AgentLoop(provider, history, undefined, enrichment, undefined, conversation.id);
          response = await agentLoop.run(input);
        }

        if (response !== NO_REPLY) {
          this.memoryManager.addAssistantMessage(conversation.id, response);
        }

        const traces = this.traceRepo.getByConversation(conversation.id);
        const durationMs = Date.now() - startMs;

        res.json({
          conversationId: conversation.id,
          userId,
          skillRouted: skillName || null,
          response: response === NO_REPLY ? '[NO_REPLY - delivered via tool]' : response,
          durationMs,
          iterations: traces.length > 0 ? Math.max(...traces.map(t => t.iteration)) : 0,
          trace: traces,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message, durationMs: Date.now() - startMs });
      }
    });

    // Get skill execution stats
    this.app.get('/api/stats', this.auth(), (_req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const skillStats = db.prepare(`
          SELECT skill_name, COUNT(*) as total, SUM(success) as successes,
            AVG(execution_time_ms) as avg_ms
          FROM skill_executions
          GROUP BY skill_name
          ORDER BY total DESC
        `).all();

        const traceStats = db.prepare(`
          SELECT COUNT(DISTINCT conversation_id) as traced_conversations,
            COUNT(*) as total_traces,
            AVG(CASE WHEN tool_name IS NOT NULL THEN 1 ELSE 0 END) as tool_call_rate
          FROM execution_traces
        `).get() ?? { traced_conversations: 0, total_traces: 0, tool_call_rate: 0 };

        res.json({ skills: skillStats, traces: traceStats });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
    // ──────────────────────────────────────────────────────────
    // PM2 status
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/pm2/status', this.auth(), (_req: Request, res: Response) => {
      try {
        const raw = execSync('pm2 jlist', { timeout: 6000 }).toString();
        const procs = JSON.parse(raw) as any[];
        const data = procs.map((p: any) => ({
          id: p.pm_id,
          name: p.name,
          status: p.pm2_env?.status ?? 'unknown',
          restarts: p.pm2_env?.restart_time ?? 0,
          uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
          memoryBytes: p.monit?.memory ?? 0,
          cpu: p.monit?.cpu ?? 0,
          pidPath: p.pm2_env?.pm_pid_path ?? null,
        }));
        res.json(data);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Campaign — stats summary
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/campaign', this.auth(), (_req: Request, res: Response) => {
      try {
        if (!fs.existsSync(LEADS_DB_PATH)) {
          return res.status(404).json({ error: 'leads.db not found' });
        }
        const db = new Database(LEADS_DB_PATH, { readonly: true });
        const total    = (db.prepare('SELECT COUNT(*) AS n FROM leads').get() as any).n;
        const sent     = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE sent_at IS NOT NULL').get() as any).n;
        const pending  = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE sent_at IS NULL AND skip=0 AND has_whatsapp=1').get() as any).n;
        const hasWa    = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE has_whatsapp=1').get() as any).n;
        const lastSent = db.prepare('SELECT title, whatsapp_number, sent_at FROM leads WHERE sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 5').all();
        db.close();

        let state: any = {};
        if (fs.existsSync(WORKER_STATE_PATH)) {
          try { state = JSON.parse(fs.readFileSync(WORKER_STATE_PATH, 'utf8')); } catch {}
        }

        res.json({ total, sent, pending, hasWa, lastSent, workerState: state });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Campaign — next leads in queue
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/campaign/queue', this.auth(), (req: Request, res: Response) => {
      try {
        if (!fs.existsSync(LEADS_DB_PATH)) {
          return res.status(404).json({ error: 'leads.db not found' });
        }
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const db = new Database(LEADS_DB_PATH, { readonly: true });
        const rows = db.prepare(
          'SELECT id, title, city, whatsapp_number FROM leads WHERE sent_at IS NULL AND skip=0 AND has_whatsapp=1 ORDER BY id LIMIT ?',
        ).all(limit);
        db.close();
        res.json(rows);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Campaign — pause today (sets all 4 slots as fired)
    // ──────────────────────────────────────────────────────────
    this.app.post('/api/campaign/pause', this.auth(), (_req: Request, res: Response) => {
      try {
        const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          .split('/').reverse().join('-');
        const isoToday = new Date().toISOString().slice(0, 10);
        const state = fs.existsSync(WORKER_STATE_PATH)
          ? JSON.parse(fs.readFileSync(WORKER_STATE_PATH, 'utf8'))
          : {};
        state.date = isoToday;
        state.sent_slots = [9, 12, 15, 18];
        fs.writeFileSync(WORKER_STATE_PATH, JSON.stringify(state, null, 2));
        res.json({ ok: true, state });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Campaign — resume today (clears slots)
    // ──────────────────────────────────────────────────────────
    this.app.post('/api/campaign/resume', this.auth(), (_req: Request, res: Response) => {
      try {
        const isoToday = new Date().toISOString().slice(0, 10);
        const state = fs.existsSync(WORKER_STATE_PATH)
          ? JSON.parse(fs.readFileSync(WORKER_STATE_PATH, 'utf8'))
          : {};
        state.date = isoToday;
        state.sent_count = 0;
        state.sent_slots = [];
        fs.writeFileSync(WORKER_STATE_PATH, JSON.stringify(state, null, 2));
        res.json({ ok: true, state });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Financial — balance summary
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/financial/balance', this.auth(), (req: Request, res: Response) => {
      try {
        const userId = req.query.userId as string;
        if (!userId) {
          res.status(400).json({ error: 'userId is required' });
          return;
        }

        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const onlyRealized = req.query.onlyRealized === 'true'; // Optional filter, default false

        const repo = new FinancialRepository();
        const result = repo.getBalance(userId, startDate, endDate, onlyRealized);
        
        res.json({
          totalIncome: result.entradas,
          totalExpense: result.saidas,
          balance: result.saldo,
          period: startDate && endDate ? {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          } : undefined
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Financial — list transactions
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/financial/transactions', this.auth(), (req: Request, res: Response) => {
      try {
        const userId = req.query.userId as string;
        if (!userId) {
          res.status(400).json({ error: 'userId is required' });
          return;
        }

        const limit = Math.min(Number(req.query.limit) || 50, 500);
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const transactionType = req.query.type as 'entrada' | 'saida' | undefined;
        const status = req.query.status as 'realizado' | 'nao_realizado' | undefined;

        const repo = new FinancialRepository();
        const transactions = repo.findMany({ userId, startDate, endDate, transactionType, status }, limit);
        res.json(transactions);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Financial — report by cost center
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/financial/report', this.auth(), (req: Request, res: Response) => {
      try {
        const userId = req.query.userId as string;
        if (!userId) {
          res.status(400).json({ error: 'userId is required' });
          return;
        }

        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const repo = new FinancialRepository();
        const expenses = repo.getExpensesByCostCenter(userId, startDate, endDate);
        
        // Calculate total for percentages
        const total = expenses.reduce((sum, item) => sum + item.total, 0);
        
        // Count transactions per cost center
        const filter = { userId, startDate, endDate, transactionType: 'saida' as const };
        const allTx = repo.findMany(filter, 999999);
        const countMap = new Map<string, number>();
        allTx.forEach(tx => {
          countMap.set(tx.costCenter, (countMap.get(tx.costCenter) || 0) + 1);
        });
        
        const report = expenses.map(item => ({
          costCenter: item.costCenter,
          totalExpense: item.total,
          percentage: total > 0 ? (item.total / total) * 100 : 0,
          transactionCount: countMap.get(item.costCenter) || 0
        }));

        res.json(report);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Skills — recent executions (for workflows visualization)
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/skills/executions/recent', this.auth(), (req: Request, res: Response) => {
      try {
        const db = DatabaseConnection.getInstance();
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        
        // Get timestamp from 1 hour ago
        const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
        
        const rows = db.prepare(`
          SELECT 
            se.id,
            se.skill_name,
            se.success,
            se.execution_time_ms as duration_ms,
            datetime(se.timestamp, 'unixepoch') as started_at,
            CASE WHEN se.success = 1 THEN 'success' ELSE 'error' END as status,
            se.user_id
          FROM skill_executions se
          WHERE se.timestamp >= ?
          ORDER BY se.timestamp DESC
          LIMIT ?
        `).all(oneHourAgo, limit);

        const formatted = rows.map((row: any) => ({
          id: row.id.toString(),
          skill_name: row.skill_name,
          status: row.status,
          started_at: row.started_at,
          duration_ms: row.duration_ms || 0,
          user_id: row.user_id,
          tools_used: [], // TODO: join with execution_traces if needed
        }));

        res.json(formatted);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Skills — get file content (for editor)
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/skills/files/:skillName', this.auth(), (req: Request, res: Response) => {
      try {
        const { skillName } = req.params;
        const skillPath = path.resolve(__dirname, `../../.agents/skills/${skillName}/SKILL.md`);
        
        if (!fs.existsSync(skillPath)) {
          return res.status(404).json({ error: 'Skill file not found' });
        }

        const content = fs.readFileSync(skillPath, 'utf8');
        
        res.json({
          name: skillName,
          path: `.agents/skills/${skillName}/SKILL.md`,
          content,
          language: 'markdown',
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Skills — save file content (for editor)
    // ──────────────────────────────────────────────────────────
    this.app.post('/api/skills/files/:skillName', this.auth(), (req: Request, res: Response) => {
      try {
        const { skillName } = req.params;
        const { content } = req.body;
        
        if (!content || typeof content !== 'string') {
          return res.status(400).json({ error: 'content is required' });
        }

        const skillPath = path.resolve(__dirname, `../../.agents/skills/${skillName}/SKILL.md`);
        
        if (!fs.existsSync(skillPath)) {
          return res.status(404).json({ error: 'Skill file not found' });
        }

        // Backup before overwriting
        const backupPath = skillPath + '.backup.' + Date.now();
        fs.copyFileSync(skillPath, backupPath);

        fs.writeFileSync(skillPath, content, 'utf8');
        
        res.json({
          ok: true,
          path: `.agents/skills/${skillName}/SKILL.md`,
          backup: backupPath,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Skills — execute skill (for testing in editor)
    // ──────────────────────────────────────────────────────────
    this.app.post('/api/skills/execute', this.auth(), async (req: Request, res: Response) => {
      try {
        const { skill, input } = req.body;
        
        if (!skill || !input) {
          return res.status(400).json({ error: 'skill and input are required' });
        }

        const startMs = Date.now();
        
        // Execute skill with empty conversation history
        const result = await SkillExecutor.execute(skill, input, []);
        const durationMs = Date.now() - startMs;

        res.json({
          ok: true,
          skill,
          result,
          durationMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message, stack: err.stack });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Files Repository — list all files
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/files', this.auth(), (_req: Request, res: Response) => {
      try {
        const filesDir = '/opt/gueclaw-data/files';
        
        if (!fs.existsSync(filesDir)) {
          return res.json([]);
        }

        const files = fs.readdirSync(filesDir)
          .filter(f => !f.startsWith('.'))
          .map(filename => {
            const filePath = path.join(filesDir, filename);
            const stats = fs.statSync(filePath);
            const ext = path.extname(filename).slice(1).toLowerCase();
            
            // Format size
            let sizeFormatted = '';
            if (stats.size < 1024) {
              sizeFormatted = `${stats.size} B`;
            } else if (stats.size < 1024 * 1024) {
              sizeFormatted = `${(stats.size / 1024).toFixed(1)} KB`;
            } else {
              sizeFormatted = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
            }

            // Determine type
            const typeMap: Record<string, string> = {
              html: 'html',
              json: 'json',
              txt: 'txt',
              md: 'md',
              csv: 'csv',
              pdf: 'pdf',
              png: 'png',
              jpg: 'jpg',
              jpeg: 'jpg',
            };
            const type = typeMap[ext] || 'other';

            return {
              name: filename,
              path: filePath,
              size: stats.size,
              sizeFormatted,
              modified: stats.mtime.toLocaleString('pt-BR'),
              type,
            };
          })
          .sort((a, b) => b.size - a.size); // Sort by date, newest first

        res.json(files);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────
    // Files Repository — serve/download specific file
    // ──────────────────────────────────────────────────────────
    this.app.get('/api/files/:filename', this.auth(), (req: Request, res: Response) => {
      try {
        const filename = String(req.params.filename);
        const filesDir = '/opt/gueclaw-data/files';
        const filePath = path.join(filesDir, filename);

        // Security: prevent path traversal
        if (!filePath.startsWith(filesDir)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'File not found' });
        }

        // Determine content type
        const ext = path.extname(filename).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          '.html': 'text/html',
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.md': 'text/markdown',
          '.csv': 'text/csv',
          '.pdf': 'application/pdf',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

  }

  private buildEnrichment(userId: string): string {
    try {
      const persistentMemory = (this.memoryManager as any).persistentMemory;
      const memory = persistentMemory?.getMemory?.(userId) || '';
      const skills = this.availableSkills;
      let enrichment = '';
      if (memory) enrichment += `[Memória do Usuário]\n${memory}\n\n`;
      if (skills.length > 0) {
        enrichment += `[Skills Disponíveis]\n${skills.map((s: any) => `- ${s.name}: ${s.description || ''}`).join('\n')}`;
      }
      return enrichment;
    } catch {
      return '';
    }
  }

  public get expressApp() {
    return this.app;
  }

  public start(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, '0.0.0.0', () => {
        console.log(`🔍 Debug API listening on http://0.0.0.0:${port}`);
        resolve();
      });
      server.on('error', reject);
    });
  }
}
