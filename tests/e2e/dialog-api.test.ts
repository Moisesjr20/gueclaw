/**
 * E2E tests for the Debug API — DOE protocol
 *
 * Uses supertest to drive HTTP requests against the Express app
 * without binding to a real port.  Relies on the existing
 * better-sqlite3 mock (rootDir/__mocks__/better-sqlite3.js).
 */
import request from 'supertest';
import { DebugAPI } from '../../src/api/debug-api';
import { ILLMProvider, CompletionOptions, ToolDefinition } from '../../src/core/providers/base-provider';
import { Message, LLMResponse, ToolResult } from '../../src/types';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { BaseTool } from '../../src/tools/base-tool';
import { ProviderFactory } from '../../src/core/providers/provider-factory';

// ─── Mock LLM provider ────────────────────────────────────────────────────────

class MockLLMProvider implements ILLMProvider {
  public readonly name = 'mock-debug-provider';
  public readonly supportsToolCalls = false;
  public readonly supportsStreaming = false;

  async generateCompletion(messages: Message[], _opts?: CompletionOptions): Promise<LLMResponse> {
    const last = messages[messages.length - 1];
    // Skill routing probe
    if (last?.content?.includes('WHICH_SKILL')) {
      return { content: 'none', finishReason: 'stop' };
    }
    // Portuguese reply check
    return {
      content: 'Olá! Sou o GueClaw, seu assistente de IA.',
      finishReason: 'stop',
    };
  }
}

// ─── Mock tool ────────────────────────────────────────────────────────────────

class EchoTool extends BaseTool {
  public readonly name = 'echo';
  public readonly description = 'Echoes back the input';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    };
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    return this.success(`Echo: ${args.text}`);
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let api: DebugAPI;

beforeAll(() => {
  ToolRegistry.clear();
  ToolRegistry.register(new EchoTool());

  // Override provider so no real OAuth is needed
  jest.spyOn(ProviderFactory, 'getFastProvider').mockReturnValue(new MockLLMProvider());
  jest.spyOn(ProviderFactory, 'getReasoningProvider').mockReturnValue(new MockLLMProvider());

  api = new DebugAPI();
});

afterAll(() => {
  ToolRegistry.clear();
  jest.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns ok:true', async () => {
    const res = await request(api.expressApp).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.ts).toBe('number');
  });
});

describe('GET /api/conversations', () => {
  it('returns an array', async () => {
    const res = await request(api.expressApp).get('/api/conversations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by userId query param', async () => {
    const res = await request(api.expressApp).get('/api/conversations?userId=nonexistent-99');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('GET /api/skills', () => {
  it('returns an array of skill names', async () => {
    const res = await request(api.expressApp).get('/api/skills');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/stats', () => {
  it('returns skills and traces stats', async () => {
    const res = await request(api.expressApp).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('skills');
    expect(res.body).toHaveProperty('traces');
  });
});

describe('POST /api/simulate', () => {
  it('returns 400 when input is missing', async () => {
    const res = await request(api.expressApp).post('/api/simulate').send({ userId: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns diagnostic object with required fields', async () => {
    const res = await request(api.expressApp)
      .post('/api/simulate')
      .send({ userId: 'doe-test-user', input: 'Olá, quem é você?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversationId');
    expect(res.body).toHaveProperty('userId', 'doe-test-user');
    expect(res.body).toHaveProperty('skillRouted');
    expect(res.body).toHaveProperty('response');
    expect(res.body).toHaveProperty('durationMs');
    expect(res.body).toHaveProperty('iterations');
    expect(Array.isArray(res.body.trace)).toBe(true);
  });

  it('response is in Portuguese (contains typical Portuguese words)', async () => {
    const res = await request(api.expressApp)
      .post('/api/simulate')
      .send({ userId: 'doe-pt-user', input: 'Quem és tu?' });

    expect(res.status).toBe(200);
    const response: string = res.body.response;
    // Mock always returns a Portuguese sentence
    expect(response).toMatch(/[Oo]lá|[Ss]ou|assistente|GueClaw/i);
  });

  it('conversations are persisted after simulate', async () => {
    const userId = 'doe-persist-test';
    await request(api.expressApp).post('/api/simulate').send({ userId, input: 'teste' });

    const listRes = await request(api.expressApp).get(`/api/conversations?userId=${userId}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);
  });

  it('trace endpoint returns rows after simulate', async () => {
    const userId = 'doe-trace-test';
    const simRes = await request(api.expressApp)
      .post('/api/simulate')
      .send({ userId, input: 'teste de trace' });

    expect(simRes.status).toBe(200);
    const convId = simRes.body.conversationId;

    const traceRes = await request(api.expressApp)
      .get(`/api/conversations/${convId}/trace`);
    expect(traceRes.status).toBe(200);
    expect(Array.isArray(traceRes.body)).toBe(true);
  });
});

describe('DELETE /api/conversations/:id', () => {
  it('deletes a conversation without error', async () => {
    // Create conversation via simulate
    const simRes = await request(api.expressApp)
      .post('/api/simulate')
      .send({ userId: 'doe-delete-test', input: 'deletar depois' });

    const convId = simRes.body.conversationId;
    const delRes = await request(api.expressApp).delete(`/api/conversations/${convId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);
  });
});

describe('GET /api/conversations/:id/messages', () => {
  it('returns messages array for a known conversation', async () => {
    const simRes = await request(api.expressApp)
      .post('/api/simulate')
      .send({ userId: 'doe-msg-test', input: 'mensagem para testar' });

    const convId = simRes.body.conversationId;
    const msgRes = await request(api.expressApp)
      .get(`/api/conversations/${convId}/messages`);

    expect(msgRes.status).toBe(200);
    expect(Array.isArray(msgRes.body)).toBe(true);
    expect(msgRes.body.length).toBeGreaterThan(0);
    // Should have user message
    const userMsg = msgRes.body.find((m: any) => m.role === 'user');
    expect(userMsg).toBeDefined();
  });
});
