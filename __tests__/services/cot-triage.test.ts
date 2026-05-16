import { CotTriage } from '../../src/services/llm-router/cot-triage';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const setEnvCot = () => {
  process.env.ROUTER_COT_ENABLED = 'true';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.ROUTER_TRIAGE_MODEL = 'test/triage-model';
};

const clearEnvCot = () => {
  delete process.env.ROUTER_COT_ENABLED;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ROUTER_TRIAGE_MODEL;
};

describe('CotTriage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearEnvCot();
  });

  describe('heuristic mode (CoT disabled)', () => {
    it('classifica saudações curtas como fast', async () => {
      const result = await CotTriage.classify('oi');
      expect(result.category).toBe('fast');
      expect(result.usedCot).toBe(false);
      expect(result.confidence).toBe(0.6);
    });

    it('classifica "hello" como fast', async () => {
      const result = await CotTriage.classify('hello, how are you?');
      expect(result.category).toBe('fast');
    });

    it('classifica perguntas de código como code', async () => {
      const result = await CotTriage.classify('me ajuda com esse bug no typescript');
      expect(result.category).toBe('code');
      expect(result.usedCot).toBe(false);
    });

    it('classifica "refator" como code', async () => {
      const result = await CotTriage.classify('refator essa função para ser mais limpa');
      expect(result.category).toBe('code');
    });

    it('classifica tarefas de shell/docker como agentic', async () => {
      const result = await CotTriage.classify('executa o container docker no servidor');
      expect(result.category).toBe('agentic');
      expect(result.usedCot).toBe(false);
    });

    it('classifica "deploy" como agentic', async () => {
      const result = await CotTriage.classify('faz o deploy via ssh no vps');
      expect(result.category).toBe('agentic');
    });

    it('classifica "execute" (verbo conjugado) como agentic', async () => {
      const result = await CotTriage.classify('execute apt update no servidor');
      expect(result.category).toBe('agentic');
    });

    it('classifica "executar" como agentic', async () => {
      const result = await CotTriage.classify('quero executar um comando no servidor');
      expect(result.category).toBe('agentic');
    });

    it('classifica "containers" (plural) como agentic', async () => {
      const result = await CotTriage.classify('verifique o status dos containers');
      expect(result.category).toBe('agentic');
    });

    it('classifica "atualize" como agentic', async () => {
      const result = await CotTriage.classify('atualize o sistema operacional');
      expect(result.category).toBe('agentic');
    });

    it('classifica "reinicie" como agentic', async () => {
      const result = await CotTriage.classify('reinicie o serviço do agente');
      expect(result.category).toBe('agentic');
    });

    it('classifica "verifique" como agentic', async () => {
      const result = await CotTriage.classify('verifique as atualizações disponíveis no sistema');
      expect(result.category).toBe('agentic');
    });

    it('classifica "instalar" como agentic', async () => {
      const result = await CotTriage.classify('instalar o fail2ban no servidor');
      expect(result.category).toBe('agentic');
    });

    it('classifica "instale" (conjugado) como agentic', async () => {
      const result = await CotTriage.classify('instale o fail2ban');
      expect(result.category).toBe('agentic');
    });

    it('classifica "servidor" (português) como agentic', async () => {
      const result = await CotTriage.classify('me dê um relatório do servidor');
      expect(result.category).toBe('agentic');
    });

    it('classifica "servidores" (plural) como agentic', async () => {
      const result = await CotTriage.classify('monitore os servidores');
      expect(result.category).toBe('agentic');
    });

    it('classifica escrita como text', async () => {
      const result = await CotTriage.classify('escreve um relatório sobre o projeto');
      expect(result.category).toBe('text');
      expect(result.usedCot).toBe(false);
    });

    it('classifica "traduza" como text', async () => {
      const result = await CotTriage.classify('traduza este artigo para o inglês');
      expect(result.category).toBe('text');
    });

    it('classifica análise lógica como reasoning', async () => {
      const result = await CotTriage.classify('analise as vantagens e desvantagens desta solução');
      expect(result.category).toBe('reasoning');
      expect(result.usedCot).toBe(false);
    });

    it('classifica "calcule" como reasoning', async () => {
      const result = await CotTriage.classify('calcule o custo total com base nos dados');
      expect(result.category).toBe('reasoning');
    });

    it('classifica mensagem muito longa como longoutput', async () => {
      const result = await CotTriage.classify('a'.repeat(700));
      expect(result.category).toBe('longoutput');
      expect(result.usedCot).toBe(false);
    });

    it('classifica "lista completa" como longoutput', async () => {
      const result = await CotTriage.classify('lista completa de todas as opções disponíveis');
      expect(result.category).toBe('longoutput');
    });

    it('classifica mensagem ambígua como fallback', async () => {
      const result = await CotTriage.classify('xyz 123 random stuff here blabla');
      expect(result.category).toBe('fallback');
      expect(result.usedCot).toBe(false);
    });

    it('retorna um model string não vazio', async () => {
      const result = await CotTriage.classify('oi');
      expect(typeof result.model).toBe('string');
      expect(result.model.length).toBeGreaterThan(0);
    });

    it('CoT desabilitado quando só OPENROUTER_API_KEY está setado', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      const result = await CotTriage.classify('debug this code');
      expect(result.usedCot).toBe(false);
      delete process.env.OPENROUTER_API_KEY;
    });

    it('CoT desabilitado quando só ROUTER_COT_ENABLED está setado', async () => {
      process.env.ROUTER_COT_ENABLED = 'true';
      const result = await CotTriage.classify('debug this code');
      expect(result.usedCot).toBe(false);
      delete process.env.ROUTER_COT_ENABLED;
    });
  });

  describe('CoT mode (CoT enabled)', () => {
    beforeEach(setEnvCot);
    afterEach(clearEnvCot);

    it('usa resposta CoT quando a API retorna JSON válido', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '{"category":"code","confidence":0.92,"reasoning":"code task"}' } }],
        },
      });

      const result = await CotTriage.classify('fix the bug in my function');
      expect(result.usedCot).toBe(true);
      expect(result.category).toBe('code');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('code task');
      expect(result.model).toBeTruthy();
    });

    it('strip de bloco <think> antes de parsear o JSON', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '<think>deep reasoning here</think>{"category":"reasoning","confidence":0.85,"reasoning":"analysis needed"}' } }],
        },
      });

      const result = await CotTriage.classify('compare esses dois algoritmos');
      expect(result.usedCot).toBe(true);
      expect(result.category).toBe('reasoning');
      expect(result.confidence).toBe(0.85);
    });

    it('strip de bloco <think> case-insensitive', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '<THINK>interno</THINK>{"category":"fast","confidence":0.95}' } }],
        },
      });

      const result = await CotTriage.classify('oi');
      expect(result.usedCot).toBe(true);
      expect(result.category).toBe('fast');
    });

    it('inclui elapsedMs quando CoT tem sucesso', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '{"category":"text","confidence":0.8}' } }],
        },
      });

      const result = await CotTriage.classify('escreva um email');
      expect(result.elapsedMs).toBeDefined();
      expect(typeof result.elapsedMs).toBe('number');
    });

    it('volta para heurística quando API lança erro', async () => {
      mockedAxios.post.mockRejectedValue(new Error('timeout'));

      const result = await CotTriage.classify('executa o docker compose');
      expect(result.usedCot).toBe(false);
      expect(result.category).toBe('agentic');
      expect(result.confidence).toBe(0.5);
    });

    it('volta para heurística quando resposta é texto inválido', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'I cannot classify this message.' } }],
        },
      });

      const result = await CotTriage.classify('oi tudo bem');
      expect(result.usedCot).toBe(false);
      expect(result.category).toBe('fast');
    });

    it('volta para heurística quando category é inválida no JSON', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '{"category":"invalid_category","confidence":0.9}' } }],
        },
      });

      const result = await CotTriage.classify('oi');
      expect(result.usedCot).toBe(false);
    });

    it('fallback usa confidence 0.5 (não 0.6 do heurístico normal)', async () => {
      mockedAxios.post.mockRejectedValue(new Error('network error'));

      const result = await CotTriage.classify('oi');
      expect(result.confidence).toBe(0.5);
    });

    it('fallback inclui elapsedMs mesmo quando CoT falha', async () => {
      mockedAxios.post.mockRejectedValue(new Error('network error'));

      const result = await CotTriage.classify('oi');
      expect(result.elapsedMs).toBeDefined();
    });

    it('passa apiKey no header Authorization', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { choices: [{ message: { content: '{"category":"fast","confidence":0.9}' } }] },
      });

      await CotTriage.classify('oi');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-key' },
        })
      );
    });

    it('limita o conteúdo da mensagem a 2000 caracteres no payload', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { choices: [{ message: { content: '{"category":"longoutput","confidence":0.8}' } }] },
      });

      const longMessage = 'x'.repeat(3000);
      await CotTriage.classify(longMessage);

      const [, body] = mockedAxios.post.mock.calls[0];
      const userContent = (body as any).messages.find((m: any) => m.role === 'user')?.content;
      expect(userContent.length).toBe(2000);
    });
  });
});
