import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../core/memory/database';
import { TraceRepository } from './trace-repository';
import { MemoryManager } from '../core/memory/memory-manager';
import { SkillLoader } from '../core/skills/skill-loader';
import { SkillRouter } from '../core/skills/skill-router';
import { SkillExecutor } from '../core/skills/skill-executor';
import { AgentLoop } from '../core/agent-loop/agent-loop';
import { ProviderFactory } from '../core/providers/provider-factory';
import { NO_REPLY } from '../types';

const DEFAULT_PORT = 3742;
const LOG_PATH = process.env.PM2_LOG_PATH || '/root/.pm2/logs/gueclaw-agent-out.log';

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
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ ok: true, ts: Date.now() });
    });

    // List recent conversations
    this.app.get('/api/conversations', (req: Request, res: Response) => {
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
    this.app.get('/api/conversations/:id/messages', (req: Request, res: Response) => {
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
    this.app.get('/api/conversations/:id/trace', (req: Request, res: Response) => {
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
    this.app.delete('/api/conversations/:id', (req: Request, res: Response) => {
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
    this.app.get('/api/logs/tail', (req: Request, res: Response) => {
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
    this.app.get('/api/skills', (_req: Request, res: Response) => {
      try {
        const skills = SkillLoader.loadAll();
        res.json(skills);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Simulate a message (bypasses Telegram, returns full diagnostic)
    this.app.post('/api/simulate', async (req: Request, res: Response) => {
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
    this.app.get('/api/stats', (_req: Request, res: Response) => {
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
      const server = this.app.listen(port, '127.0.0.1', () => {
        console.log(`🔍 Debug API listening on http://127.0.0.1:${port}`);
        resolve();
      });
      server.on('error', reject);
    });
  }
}
