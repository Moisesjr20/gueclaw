import { DatabaseConnection } from '../core/memory/database';
import { randomUUID } from 'crypto';

export interface ExecutionTrace {
  id: string;
  conversationId: string;
  messageId?: string;
  iteration: number;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  thought?: string;
  tokensUsed?: number;
  finishReason?: string;
  createdAt: number;
}

export interface AddTraceInput {
  conversationId: string;
  messageId?: string;
  iteration: number;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: string;
  thought?: string;
  tokensUsed?: number;
  finishReason?: string;
}

export class TraceRepository {
  private static instance: TraceRepository | null = null;

  public static getInstance(): TraceRepository {
    if (!TraceRepository.instance) {
      TraceRepository.instance = new TraceRepository();
    }
    return TraceRepository.instance;
  }

  public addTrace(input: AddTraceInput): ExecutionTrace {
    const db = DatabaseConnection.getInstance();
    const trace: ExecutionTrace = {
      id: randomUUID(),
      conversationId: input.conversationId,
      messageId: input.messageId,
      iteration: input.iteration,
      toolName: input.toolName,
      toolArgs: input.toolArgs ? JSON.stringify(input.toolArgs) : undefined,
      toolResult: input.toolResult,
      thought: input.thought,
      tokensUsed: input.tokensUsed,
      finishReason: input.finishReason,
      createdAt: Math.floor(Date.now() / 1000),
    };

    db.prepare(`
      INSERT INTO execution_traces (id, conversation_id, message_id, iteration, tool_name, tool_args, tool_result, thought, tokens_used, finish_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trace.id,
      trace.conversationId,
      trace.messageId ?? null,
      trace.iteration,
      trace.toolName ?? null,
      trace.toolArgs ?? null,
      trace.toolResult ?? null,
      trace.thought ?? null,
      trace.tokensUsed ?? null,
      trace.finishReason ?? null,
      trace.createdAt,
    );

    return trace;
  }

  public getByConversation(conversationId: string, limit = 200): ExecutionTrace[] {
    const db = DatabaseConnection.getInstance();
    const rows = db.prepare(`
      SELECT id, conversation_id, message_id, iteration, tool_name, tool_args, tool_result, thought, tokens_used, finish_reason, created_at
      FROM execution_traces
      WHERE conversation_id = ?
      ORDER BY created_at ASC, iteration ASC
      LIMIT ?
    `).all(conversationId, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      conversationId: r.conversation_id,
      messageId: r.message_id ?? undefined,
      iteration: r.iteration,
      toolName: r.tool_name ?? undefined,
      toolArgs: r.tool_args ?? undefined,
      toolResult: r.tool_result ?? undefined,
      thought: r.thought ?? undefined,
      tokensUsed: r.tokens_used ?? undefined,
      finishReason: r.finish_reason ?? undefined,
      createdAt: r.created_at,
    }));
  }

  public deleteByConversation(conversationId: string): number {
    const db = DatabaseConnection.getInstance();
    const result = db.prepare('DELETE FROM execution_traces WHERE conversation_id = ?').run(conversationId);
    return result.changes;
  }

  public getLatestConversationIds(limit = 20): string[] {
    const db = DatabaseConnection.getInstance();
    const rows = db.prepare(`
      SELECT DISTINCT conversation_id, MAX(created_at) AS last_seen
      FROM execution_traces
      GROUP BY conversation_id
      ORDER BY last_seen DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(r => r.conversation_id);
  }
}
