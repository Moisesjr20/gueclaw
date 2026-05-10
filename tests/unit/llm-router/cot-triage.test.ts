import { CotTriage } from '../../../src/services/llm-router/cot-triage';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const COT_ENABLED_ENVS = {
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  ROUTER_COT_ENABLED: 'true',
  ROUTER_TRIAGE_MODEL: 'deepseek/deepseek-r1',
};

function mockLLMResponse(content: string) {
  mockedAxios.post.mockResolvedValueOnce({
    data: { choices: [{ message: { content } }] },
  });
}

describe('CotTriage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, COT_ENABLED_ENVS);
  });

  afterEach(() => {
    Object.keys(COT_ENABLED_ENVS).forEach(k => delete process.env[k]);
    Object.assign(process.env, originalEnv);
  });

  // ── CoT enabled (API calls) ──────────────────────────────────────────────

  describe('classify() with ROUTER_COT_ENABLED=true', () => {
    it('returns valid category and confidence from LLM JSON', async () => {
      mockLLMResponse('{"category":"reasoning","confidence":0.92,"reasoning":"math calc"}');
      const result = await CotTriage.classify('calcule o break-even com receita 50k');
      expect(result.category).toBe('reasoning');
      expect(result.confidence).toBe(0.92);
      expect(result.usedCot).toBe(true);
      expect(result.model.length).toBeGreaterThan(0);
    });

    it('strips <think>...</think> block before parsing JSON', async () => {
      mockLLMResponse('<think>long reasoning here...</think>{"category":"code","confidence":0.88,"reasoning":"typescript code"}');
      const result = await CotTriage.classify('escreva código TypeScript para parsear CSV');
      expect(result.category).toBe('code');
      expect(result.usedCot).toBe(true);
    });

    it('routes tool/command message to agentic', async () => {
      mockLLMResponse('{"category":"agentic","confidence":0.91,"reasoning":"shell command"}');
      const result = await CotTriage.classify('execute docker ps nos containers');
      expect(result.category).toBe('agentic');
    });

    it('routes writing request to text', async () => {
      mockLLMResponse('{"category":"text","confidence":0.87,"reasoning":"text writing"}');
      const result = await CotTriage.classify('escreva um email profissional para o cliente');
      expect(result.category).toBe('text');
    });

    it('sets elapsedMs on successful CoT call', async () => {
      mockLLMResponse('{"category":"fast","confidence":0.95,"reasoning":"simple greeting"}');
      const result = await CotTriage.classify('olá');
      expect(typeof result.elapsedMs).toBe('number');
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('falls back to heuristic when axios throws (network error)', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network timeout'));
      const result = await CotTriage.classify('olá bom dia tudo bem');
      expect(result.usedCot).toBe(false);
      expect(['fast', 'fallback']).toContain(result.category);
    });

    it('falls back to heuristic when LLM returns invalid JSON', async () => {
      mockLLMResponse('I cannot classify this right now.');
      const result = await CotTriage.classify('alguma mensagem');
      expect(result.usedCot).toBe(false);
    });

    it('falls back to heuristic when category is not in valid list', async () => {
      mockLLMResponse('{"category":"unknown_category","confidence":0.5,"reasoning":"???"}');
      const result = await CotTriage.classify('alguma mensagem');
      expect(result.usedCot).toBe(false);
    });
  });

  // ── Heuristic mode (no API calls) ───────────────────────────────────────

  describe('classify() with ROUTER_COT_ENABLED=false (heuristic)', () => {
    beforeEach(() => {
      process.env.ROUTER_COT_ENABLED = 'false';
    });

    it('does NOT call the OpenRouter API', async () => {
      await CotTriage.classify('qualquer mensagem');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('routes short greeting to fast', async () => {
      const result = await CotTriage.classify('olá bom dia');
      expect(result.category).toBe('fast');
      expect(result.usedCot).toBe(false);
    });

    it('routes TypeScript/code keyword to code', async () => {
      const result = await CotTriage.classify('crie uma função TypeScript para parsear CSV');
      expect(result.category).toBe('code');
    });

    it('routes docker/shell keywords to agentic', async () => {
      const result = await CotTriage.classify('execute o comando docker ps no servidor');
      expect(result.category).toBe('agentic');
    });

    it('routes analise/compare keywords to reasoning', async () => {
      const result = await CotTriage.classify('analise e compare as duas abordagens estratégicas');
      expect(result.category).toBe('reasoning');
    });

    it('routes escreva/texto keywords to text', async () => {
      const result = await CotTriage.classify('escreva um relatório completo sobre o projeto');
      expect(result.category).toBe('text');
    });

    it('always returns a model string for any category', async () => {
      const msgs = [
        'olá',
        'escreva um código python',
        'analise os dados financeiros',
        'execute docker compose up',
        'escreva um artigo sobre IA',
        'crie um documento detalhado e completo',
      ];
      for (const msg of msgs) {
        const result = await CotTriage.classify(msg);
        expect(typeof result.model).toBe('string');
        expect(result.model.length).toBeGreaterThan(0);
      }
    });
  });
});
