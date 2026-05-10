# GueClaw · Plano de Refatoração do LLM Routing
## Implementação Multi-Agentes via OpenRouter — TypeScript Edition

> **Documento para execução via Claude Code**
> Baseado na análise real do repositório `Moisesjr20/gueclaw`
> Versão 2.0 · Maio 2026

---

## CONTEXTO: O Que Existe e O Que Muda

### Arquitetura atual do routing

O GueClaw hoje usa um **Smart Routing baseado em regras** implementado no `provider-factory.ts`:

```
Se mensagem.length < 160 chars E nenhuma keyword complexa → DeepSeek Fast (barato)
Se mensagem tem keyword (debug, docker, code...) OU length > 160 → modelo poderoso
```

Isso é determinístico, mas cego — não entende semântica, contexto ou domínio da tarefa.

### O que vai mudar

Substituir a função `selectProvider()` do `provider-factory.ts` por um **Triador CoT via LLM** que usa DeepSeek R1 para classificar semanticamente cada tarefa e rotear para o especialista correto via OpenRouter.

### O que NÃO muda

- Arquitetura DVACE (agent-loop, tool-orchestrator, task-tracking)
- Sistema de subagentes paralelos
- Error Recovery System
- Skills, cron, context files, memória
- Interface Telegram
- Toda a camada de tools

---

## MAPA DE ARQUIVOS AFETADOS

```
src/
├── core/
│   └── providers/
│       ├── base-provider.ts           ← LER (interface a implementar)
│       ├── provider-factory.ts        ← MODIFICAR (substituir selectProvider)
│       ├── github-copilot-provider.ts ← LER (padrão de implementação)
│       ├── deepseek-provider.ts       ← LER (padrão de implementação)
│       └── openrouter-provider.ts     ← CRIAR (novo provider unificado)
│
├── services/
│   └── llm-router/                    ← CRIAR (pasta nova)
│       ├── cot-triage.ts             ← CRIAR (triador CoT)
│       ├── router-config.ts          ← CRIAR (mapa de especialistas)
│       └── router-logger.ts          ← CRIAR (logging de decisões)
│
└── types/
    └── routing-types.ts              ← CRIAR (tipos do novo sistema)

.env                                   ← MODIFICAR (adicionar variáveis)
```

---

## PASSO 0 — Reconhecimento do Código Real

**O Claude Code DEVE executar estes comandos antes de qualquer criação de arquivo:**

```bash
# 1. Ver a estrutura real de providers
cat src/core/providers/base-provider.ts
cat src/core/providers/provider-factory.ts
cat src/core/providers/deepseek-provider.ts

# 2. Entender como o provider é chamado no agent loop
grep -r "providerFactory\|getProvider\|selectProvider\|DEFAULT_PROVIDER" src/ --include="*.ts" -n

# 3. Ver como o provider é instanciado no entry point
cat src/index.ts | head -80

# 4. Ver variáveis de env relacionadas a LLM
grep -E "OPENROUTER|DEEPSEEK|ANTHROPIC|SMART_ROUTING|DEFAULT_PROVIDER" .env.example
```

> **Por que isso importa:** Os nomes reais dos métodos, interfaces e tipos podem diferir do gueclaw.md.
> O Claude Code deve adaptar o código abaixo aos nomes reais encontrados.

---

## PASSO 1 — Atualizar `.env`

Adicionar ao `.env` (sem remover as variáveis existentes):

```env
# ============================================
# LLM ROUTING v2 — CoT Multi-Agent via OpenRouter
# ============================================

# Chave OpenRouter (interface OpenAI-compatível, acesso a 200+ modelos)
OPENROUTER_API_KEY=sk-or-v1-PREENCHER
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=GueClaw-Agent
OPENROUTER_HTTP_REFERER=https://kyrius.com.br

# ---- Modelo Triador (CoT — classifica a tarefa) ----
# DeepSeek R1: raciocínio nativo, temperatura baixa, decisão determinística
ROUTER_TRIAGE_MODEL=deepseek/deepseek-r1
ROUTER_TRIAGE_MAX_TOKENS=800
ROUTER_TRIAGE_TEMPERATURE=0.1

# ---- Especialistas ----
ROUTER_MODEL_REASONING=deepseek/deepseek-r1
ROUTER_MODEL_AGENTIC=moonshotai/kimi-k2
ROUTER_MODEL_TEXT=qwen/qwen3.5-plus-20260420
ROUTER_MODEL_FAST=google/gemma-4-27b-it
ROUTER_MODEL_LONGOUTPUT=thudm/glm-4-plus
ROUTER_MODEL_CODE=deepseek/deepseek-r1

# ---- Fallback se especialista falhar ----
ROUTER_FALLBACK_MODEL=deepseek/deepseek-chat

# ---- Feature flag: ativa/desativa o novo routing ----
# false = mantém comportamento anterior (safe rollback)
ROUTER_COT_ENABLED=true

# ---- Debug ----
ROUTER_DEBUG_LOG=true
```

---

## PASSO 2 — Criar `src/types/routing-types.ts`

```typescript
// src/types/routing-types.ts
// Tipos do sistema de roteamento CoT v2

export type SpecialistKey =
  | 'reasoning'   // DeepSeek R1 — lógica, cálculo, debugging
  | 'agentic'     // Kimi K2    — workflows multi-step, pipelines
  | 'text'        // Qwen 3.5   — geração de texto, multilingual
  | 'fast'        // Gemma 4    — respostas rápidas, baixo custo
  | 'longoutput'  // GLM-5      — outputs > 4K tokens
  | 'code'        // DeepSeek R1 — código, arquitetura, refatoração
  | 'fallback';   // DeepSeek Chat — usado quando especialista falha

export type TaskComplexity = 'simple' | 'medium' | 'complex';

export interface TriageDecision {
  specialist: SpecialistKey;
  complexity: TaskComplexity;
  domain_tags: string[];
  reasoning: string;
  formatted_task: string;
  confidence: number; // 0.0–1.0
}

export interface RoutingResult {
  response: string;
  specialist_used: SpecialistKey;
  model_id: string;
  triage_decision: TriageDecision;
  latency_ms: number;
  fallback_used: boolean;
}

export interface SpecialistConfig {
  model_id: string;
  max_tokens: number;
  temperature: number;
  system_prompt: string;
  description: string;
}
```

---

## PASSO 3 — Criar `src/services/llm-router/router-config.ts`

```typescript
// src/services/llm-router/router-config.ts
// Configuração centralizada de todos os especialistas

import { SpecialistKey, SpecialistConfig } from '../../types/routing-types';

// System prompts inline (sem arquivos externos — mais fácil de manter)
const SYSTEM_PROMPTS: Record<SpecialistKey, string> = {
  reasoning: `Você é um especialista em raciocínio lógico, análise financeira e debugging técnico do GueClaw (Kyrius Consulting).

Regras:
- Pense passo a passo antes de responder
- Mostre os cálculos quando relevante
- Para debugging: identifique causa raiz, não apenas sintoma
- Responda em português brasileiro
- Quando relevante, cite impactos de negócio dos resultados técnicos

Contexto: consultoria financeira e BPO para PMEs brasileiras.`,

  agentic: `Você é um especialista em automação e workflows do GueClaw (Kyrius Consulting).

Stack técnico: n8n, Python/FastAPI, Supabase, Evolution API (WhatsApp), ContaAzul, Stripe, Asaas, Pagar.me, Google Workspace, GoHighLevel, EasyPanel VPS.

Regras:
- Decomponha tarefas em etapas numeradas e executáveis
- Especifique payloads JSON quando relevante
- Antecipe pontos de falha e sugira tratamento de erros
- Use nomenclatura exata dos sistemas acima
- Responda em português brasileiro`,

  text: `Você é um especialista em comunicação empresarial do GueClaw (Kyrius Consulting).

Contexto: consultoria financeira/BPO para PMEs brasileiras. Comunicações com clientes (Ricardo, George Soares), equipe (Mateus, Raquel, Eliene, Lucas, Lacerda, Albuquerque) e parceiros.

Regras:
- Português brasileiro profissional e direto
- Tom adequado ao contexto (formal para clientes, colaborativo para equipe)
- Documentos longos com seções claras
- Sem prolixidade`,

  fast: `Assistente rápido e objetivo. Responda de forma direta e concisa. Sem introduções. Português brasileiro.`,

  longoutput: `Você é um especialista em documentação e relatórios detalhados do GueClaw.

Regras:
- Documentos completos e bem estruturados
- Use hierarquia clara: títulos, subtítulos, listas, tabelas
- Para planos técnicos: inclua contexto, decisões, trade-offs, próximos passos
- Para relatórios financeiros: siga padrões contábeis brasileiros
- Português brasileiro profissional`,

  code: `Você é um especialista em desenvolvimento de software do GueClaw.

Stack: TypeScript/Node.js, Python/FastAPI, n8n, Docker, EasyPanel.

Regras:
- Código limpo, tipado e comentado
- Explique as decisões arquiteturais
- Inclua tratamento de erros
- Sugira testes quando relevante
- Responda em português brasileiro`,

  fallback: `Assistente geral do GueClaw. Responda de forma útil e direta em português brasileiro.`,
};

export function getSpecialistConfigs(): Record<SpecialistKey, SpecialistConfig> {
  return {
    reasoning: {
      model_id: process.env.ROUTER_MODEL_REASONING || 'deepseek/deepseek-r1',
      max_tokens: 4096,
      temperature: 0.3,
      system_prompt: SYSTEM_PROMPTS.reasoning,
      description: 'DeepSeek R1 — raciocínio lógico e análise financeira',
    },
    agentic: {
      model_id: process.env.ROUTER_MODEL_AGENTIC || 'moonshotai/kimi-k2',
      max_tokens: 8192,
      temperature: 0.5,
      system_prompt: SYSTEM_PROMPTS.agentic,
      description: 'Kimi K2 — workflows e automações multi-step',
    },
    text: {
      model_id: process.env.ROUTER_MODEL_TEXT || 'qwen/qwen3.5-plus-20260420',
      max_tokens: 4096,
      temperature: 0.7,
      system_prompt: SYSTEM_PROMPTS.text,
      description: 'Qwen 3.5 — geração de texto e comunicação',
    },
    fast: {
      model_id: process.env.ROUTER_MODEL_FAST || 'google/gemma-4-27b-it',
      max_tokens: 512,
      temperature: 0.3,
      system_prompt: SYSTEM_PROMPTS.fast,
      description: 'Gemma 4 — respostas rápidas e baixo custo',
    },
    longoutput: {
      model_id: process.env.ROUTER_MODEL_LONGOUTPUT || 'thudm/glm-4-plus',
      max_tokens: 16384,
      temperature: 0.5,
      system_prompt: SYSTEM_PROMPTS.longoutput,
      description: 'GLM-5 — documentos e relatórios extensos',
    },
    code: {
      model_id: process.env.ROUTER_MODEL_CODE || 'deepseek/deepseek-r1',
      max_tokens: 8192,
      temperature: 0.2,
      system_prompt: SYSTEM_PROMPTS.code,
      description: 'DeepSeek R1 — código e arquitetura de software',
    },
    fallback: {
      model_id: process.env.ROUTER_FALLBACK_MODEL || 'deepseek/deepseek-chat',
      max_tokens: 4096,
      temperature: 0.5,
      system_prompt: SYSTEM_PROMPTS.fallback,
      description: 'DeepSeek Chat — fallback geral',
    },
  };
}
```

---

## PASSO 4 — Criar `src/services/llm-router/router-logger.ts`

```typescript
// src/services/llm-router/router-logger.ts
// Logger de decisões de roteamento (para debug e analytics futuros)

import { TriageDecision, SpecialistKey } from '../../types/routing-types';

const DEBUG = process.env.ROUTER_DEBUG_LOG === 'true';

export function logTriageDecision(
  input: string,
  decision: TriageDecision,
  latencyMs: number
): void {
  if (!DEBUG) return;

  const preview = input.length > 60 ? input.substring(0, 60) + '...' : input;

  console.log([
    `[Router] ─────────────────────────────`,
    `[Router] Input   : "${preview}"`,
    `[Router] Specialist: ${decision.specialist} (${decision.complexity})`,
    `[Router] Tags    : ${decision.domain_tags.join(', ')}`,
    `[Router] Reason  : ${decision.reasoning}`,
    `[Router] Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
    `[Router] Triage  : ${latencyMs}ms`,
    `[Router] ─────────────────────────────`,
  ].join('\n'));
}

export function logFallback(
  specialist: SpecialistKey,
  error: string,
  fallbackModel: string
): void {
  console.warn(
    `[Router] ⚠️ Especialista '${specialist}' falhou: ${error}. Usando fallback: ${fallbackModel}`
  );
}

export function logRoutingError(context: string, error: unknown): void {
  console.error(`[Router] ❌ Erro em ${context}:`, error);
}
```

---

## PASSO 5 — Criar `src/services/llm-router/cot-triage.ts`

Este é o núcleo do sistema. O triador CoT usa DeepSeek R1 via OpenRouter para classificar semanticamente cada mensagem.

```typescript
// src/services/llm-router/cot-triage.ts
// Triador CoT: usa LLM para classificar tarefas semanticamente

import OpenAI from 'openai';
import { TriageDecision, SpecialistKey } from '../../types/routing-types';
import { logRoutingError } from './router-logger';

// ─── Prompt do Triador ───────────────────────────────────────────────────────

const TRIAGE_SYSTEM_PROMPT = `Você é o TRIADOR do sistema GueClaw, um agente de IA pessoal para VPS com interface Telegram.

Sua ÚNICA função é analisar a mensagem do usuário e decidir qual especialista deve responder.

## ESPECIALISTAS DISPONÍVEIS

| Chave      | Modelo         | Quando usar                                                           |
|------------|----------------|-----------------------------------------------------------------------|
| reasoning  | DeepSeek R1    | Lógica de negócio, análise financeira, debugging, cálculos, math      |
| agentic    | Kimi K2        | Workflows n8n, automações, integrações de API, pipelines multi-step   |
| text       | Qwen 3.5       | Emails, comunicados, contratos, relatórios de texto, resumos          |
| fast       | Gemma 4        | Perguntas diretas, confirmações, respostas curtas (< 3 frases)        |
| longoutput | GLM-5          | Documentação extensa, planos detalhados, relatórios com > 4 seções    |
| code       | DeepSeek R1    | Código TypeScript/Python/JS, arquitetura, refatoração, testes         |

## SEU PROCESSO DE RACIOCÍNIO (OBRIGATÓRIO)

Antes de decidir, pense internamente:
1. O que o usuário quer exatamente?
2. Qual é o domínio principal? (finanças / automação / texto / código / resposta rápida / documento longo)
3. Qual é a complexidade? (simple = 1 etapa / medium = 2-3 etapas / complex = 4+ etapas ou raciocínio profundo)
4. Qual especialista atende melhor?

## REGRAS CRÍTICAS

- "fast" NUNCA para tarefas com cálculos, código ou múltiplas etapas
- "longoutput" apenas quando a saída esperada for genuinamente longa (relatórios completos, planos extensos)
- "code" para qualquer pedido que envolva escrever, revisar ou debugar código
- Em dúvida entre "reasoning" e outro: prefira "reasoning"
- "formatted_task" deve conter TODA informação relevante do input — o especialista não verá o input original

## SAÍDA (JSON OBRIGATÓRIO — sem texto fora do JSON)

{
  "specialist": "chave_do_especialista",
  "complexity": "simple|medium|complex",
  "domain_tags": ["tag1", "tag2"],
  "reasoning": "explicação em 1 frase do motivo",
  "formatted_task": "tarefa reformulada com todo o contexto necessário para o especialista",
  "confidence": 0.0_a_1.0
}`;

// ─── Fallback determinístico (quando CoT falha) ──────────────────────────────

const KEYWORD_MAP: Record<string, SpecialistKey> = {
  // Code
  typescript: 'code', javascript: 'code', python: 'code',
  código: 'code', code: 'code', bug: 'code', debug: 'code',
  refactor: 'code', implementar: 'code', função: 'code',
  classe: 'code', api: 'code', endpoint: 'code',

  // Agentic
  'n8n': 'agentic', workflow: 'agentic', automação: 'agentic',
  webhook: 'agentic', integração: 'agentic', pipeline: 'agentic',
  whatsapp: 'agentic', evolution: 'agentic', cron: 'agentic',

  // Reasoning
  calcule: 'reasoning', análise: 'reasoning', financeiro: 'reasoning',
  receita: 'reasoning', custo: 'reasoning', margem: 'reasoning',
  'break-even': 'reasoning', lógica: 'reasoning',

  // Long output
  relatório: 'longoutput', documentação: 'longoutput', plano: 'longoutput',
  especificação: 'longoutput', manual: 'longoutput',
};

function deterministicFallback(input: string): TriageDecision {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/);

  let detected: SpecialistKey = 'fast';
  for (const word of words) {
    if (KEYWORD_MAP[word]) {
      detected = KEYWORD_MAP[word];
      break;
    }
  }

  // Heurística de comprimento
  if (detected === 'fast' && input.length > 120) {
    detected = 'reasoning';
  }

  return {
    specialist: detected,
    complexity: input.length < 50 ? 'simple' : input.length < 200 ? 'medium' : 'complex',
    domain_tags: ['fallback-deterministic'],
    reasoning: 'Fallback por falha no triador CoT',
    formatted_task: input,
    confidence: 0.5,
  };
}

// ─── Classe Principal ────────────────────────────────────────────────────────

export class CotTriage {
  private client: OpenAI;
  private triageModel: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://kyrius.com.br',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'GueClaw-Agent',
      },
    });

    this.triageModel = process.env.ROUTER_TRIAGE_MODEL || 'deepseek/deepseek-r1';
    this.maxTokens = parseInt(process.env.ROUTER_TRIAGE_MAX_TOKENS || '800', 10);
    this.temperature = parseFloat(process.env.ROUTER_TRIAGE_TEMPERATURE || '0.1');
  }

  async classify(userInput: string): Promise<TriageDecision> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.triageModel,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
          { role: 'user', content: userInput },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content || '';

      // Limpar markdown do JSON caso o modelo retorne ```json
      const clean = raw
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();

      const parsed = JSON.parse(clean) as TriageDecision;

      // Validar campos obrigatórios
      const validSpecialists: SpecialistKey[] = [
        'reasoning', 'agentic', 'text', 'fast', 'longoutput', 'code', 'fallback'
      ];

      if (!validSpecialists.includes(parsed.specialist)) {
        throw new Error(`Specialist inválido: ${parsed.specialist}`);
      }

      return {
        specialist: parsed.specialist,
        complexity: parsed.complexity || 'medium',
        domain_tags: Array.isArray(parsed.domain_tags) ? parsed.domain_tags : [],
        reasoning: parsed.reasoning || '',
        formatted_task: parsed.formatted_task || userInput,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };

    } catch (error) {
      logRoutingError('CotTriage.classify', error);
      // Fallback determinístico sem interromper o fluxo
      return deterministicFallback(userInput);
    }
  }
}

// Singleton
let triageInstance: CotTriage | null = null;

export function getCotTriage(): CotTriage {
  if (!triageInstance) {
    triageInstance = new CotTriage();
  }
  return triageInstance;
}
```

---

## PASSO 6 — Criar `src/core/providers/openrouter-provider.ts`

Este arquivo implementa um provider OpenRouter que segue a interface `BaseProvider` existente no projeto.

> **ATENÇÃO ao Claude Code:** Antes de criar este arquivo, execute:
> ```bash
> cat src/core/providers/base-provider.ts
> cat src/core/providers/deepseek-provider.ts
> ```
> Adapte os nomes de métodos e interfaces ao que for encontrado.

```typescript
// src/core/providers/openrouter-provider.ts
// Provider OpenRouter — interface OpenAI-compatível, acesso a 200+ modelos

import OpenAI from 'openai';
// ATENÇÃO: importar BaseProvider e tipos da interface real do projeto
// Substitua o caminho e nomes abaixo pelo que o cat revelar
import { BaseProvider, ProviderMessage, ProviderResponse, ToolDefinition } from './base-provider';
import { getCotTriage } from '../../services/llm-router/cot-triage';
import { getSpecialistConfigs } from '../../services/llm-router/router-config';
import { logTriageDecision, logFallback, logRoutingError } from '../../services/llm-router/router-logger';
import { SpecialistKey, RoutingResult } from '../../types/routing-types';

export class OpenRouterProvider extends BaseProvider {
  private client: OpenAI;
  private lastRoutingResult: RoutingResult | null = null;

  constructor() {
    super();
    this.client = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://kyrius.com.br',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'GueClaw-Agent',
      },
    });
  }

  // ─── Método principal chamado pelo agent-loop ─────────────────────────────
  // ATENÇÃO: adapte a assinatura ao que BaseProvider define no projeto real

  async complete(
    messages: ProviderMessage[],
    tools?: ToolDefinition[]
  ): Promise<ProviderResponse> {

    // Extrair a última mensagem do usuário para triagem
    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user');

    const userInput = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : JSON.stringify(lastUserMessage?.content || '');

    // ─── Triagem CoT ────────────────────────────────────────────────────────
    const cotEnabled = process.env.ROUTER_COT_ENABLED !== 'false';

    const triageStart = Date.now();
    const triage = cotEnabled
      ? await getCotTriage().classify(userInput)
      : { specialist: 'fallback' as SpecialistKey, complexity: 'medium' as const,
          domain_tags: [], reasoning: 'CoT disabled', formatted_task: userInput, confidence: 1.0 };

    const triageLatency = Date.now() - triageStart;
    logTriageDecision(userInput, triage, triageLatency);

    // ─── Chamar especialista ─────────────────────────────────────────────────
    const configs = getSpecialistConfigs();
    const specialistConfig = configs[triage.specialist];

    let response: ProviderResponse;
    let fallbackUsed = false;
    const executionStart = Date.now();

    try {
      response = await this._callModel(
        specialistConfig.model_id,
        specialistConfig.system_prompt,
        messages,
        tools,
        specialistConfig.max_tokens,
        specialistConfig.temperature
      );
    } catch (error) {
      // Fallback automático
      const fallbackConfig = configs['fallback'];
      logFallback(triage.specialist, String(error), fallbackConfig.model_id);
      fallbackUsed = true;

      response = await this._callModel(
        fallbackConfig.model_id,
        fallbackConfig.system_prompt,
        messages,
        tools,
        fallbackConfig.max_tokens,
        fallbackConfig.temperature
      );
    }

    // Salvar resultado para consulta/debug
    this.lastRoutingResult = {
      response: typeof response.content === 'string' ? response.content : '',
      specialist_used: fallbackUsed ? 'fallback' : triage.specialist,
      model_id: fallbackUsed ? configs['fallback'].model_id : specialistConfig.model_id,
      triage_decision: triage,
      latency_ms: Date.now() - executionStart,
      fallback_used: fallbackUsed,
    };

    return response;
  }

  // ─── Chamada ao modelo via OpenRouter ────────────────────────────────────

  private async _callModel(
    modelId: string,
    systemPrompt: string,
    messages: ProviderMessage[],
    tools: ToolDefinition[] | undefined,
    maxTokens: number,
    temperature: number
  ): Promise<ProviderResponse> {

    // Montar mensagens com system prompt do especialista
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      })),
    ];

    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: modelId,
      messages: allMessages,
      max_tokens: maxTokens,
      temperature,
    };

    // Adicionar tools se fornecidas e o modelo suportar
    if (tools && tools.length > 0) {
      requestParams.tools = tools.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const completion = await this.client.chat.completions.create(requestParams);

    // ─── Adaptar resposta ao formato ProviderResponse ──────────────────────
    // ATENÇÃO: adapte este bloco ao tipo ProviderResponse real do projeto
    const choice = completion.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Resposta com tool calls — adaptar ao formato do projeto
      return {
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })),
        finish_reason: 'tool_calls',
      } as ProviderResponse;
    }

    return {
      content: choice.message.content || '',
      tool_calls: [],
      finish_reason: choice.finish_reason || 'stop',
    } as ProviderResponse;
  }

  // ─── Getters para debug/dashboard ────────────────────────────────────────

  getLastRoutingResult(): RoutingResult | null {
    return this.lastRoutingResult;
  }

  // Expor modelo atual para o cost tracker (ele pode precisar disso)
  getCurrentModelId(): string {
    return this.lastRoutingResult?.model_id || process.env.ROUTER_FALLBACK_MODEL || 'deepseek/deepseek-chat';
  }
}
```

---

## PASSO 7 — Modificar `src/core/providers/provider-factory.ts`

> **O Claude Code deve ler o arquivo real antes de editar.**
> O bloco abaixo mostra o PADRÃO da modificação — adaptar aos nomes reais.

```typescript
// src/core/providers/provider-factory.ts
// MODIFICAÇÃO: adicionar OpenRouterProvider e nova lógica de seleção

import { OpenRouterProvider } from './openrouter-provider';
// ... manter imports existentes ...

export class ProviderFactory {

  // MODIFICAR este método (ou equivalente encontrado no arquivo real)
  static createProvider(providerName?: string): BaseProvider {

    const name = providerName
      || process.env.DEFAULT_PROVIDER
      || 'deepseek';

    // ─── NOVO: verificar se o routing CoT está habilitado ─────────────────
    const useOpenRouter = process.env.OPENROUTER_API_KEY
      && process.env.ROUTER_COT_ENABLED !== 'false';

    if (useOpenRouter && !['github-copilot'].includes(name)) {
      // Usar OpenRouter com triador CoT para todos os providers genéricos
      return new OpenRouterProvider();
    }

    // ─── Manter lógica existente como fallback ────────────────────────────
    switch (name) {
      case 'github-copilot':
        return new GitHubCopilotProvider(); // Manter — usa OAuth diferente
      case 'deepseek':
        return new DeepSeekProvider();
      case 'deepseek-reasoner':
        return new DeepSeekProvider({ model: 'deepseek-reasoner' });
      default:
        console.warn(`[ProviderFactory] Provider desconhecido: ${name}. Usando DeepSeek.`);
        return new DeepSeekProvider();
    }
  }

  // MANTER todos os outros métodos existentes
}
```

---

## PASSO 8 — Adicionar comando `/routing` no Telegram

> Localizar onde os comandos Telegram são registrados. Baseado na estrutura vista:
> `src/commands/telegram-commands.ts` ou `src/handlers/command-handler.ts`

```typescript
// Adicionar ao arquivo de comandos existente

// Comando /routing — mostra última decisão de roteamento
bot.command('routing', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!allowedUsers.includes(userId)) return;

  // Obter o provider atual (se for OpenRouterProvider)
  const provider = ProviderFactory.getCurrentProvider?.();

  if (provider instanceof OpenRouterProvider) {
    const result = provider.getLastRoutingResult();
    if (!result) {
      return ctx.reply('Nenhuma decisão de roteamento registrada ainda.');
    }

    const msg = [
      `🧭 *Último Roteamento*`,
      ``,
      `🤖 Especialista: \`${result.specialist_used}\``,
      `📦 Modelo: \`${result.model_id}\``,
      `⚡ Latência: ${result.latency_ms}ms`,
      `🔄 Fallback: ${result.fallback_used ? 'Sim' : 'Não'}`,
      ``,
      `📋 Tags: ${result.triage_decision.domain_tags.join(', ')}`,
      `💭 Motivo: ${result.triage_decision.reasoning}`,
      `🎯 Confiança: ${(result.triage_decision.confidence * 100).toFixed(0)}%`,
    ].join('\n');

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  return ctx.reply('OpenRouter provider não está ativo.');
});
```

---

## PASSO 9 — Testes de Validação

Criar `tests/unit/llm-router.test.ts`:

```typescript
// tests/unit/llm-router.test.ts

import { CotTriage } from '../../src/services/llm-router/cot-triage';
import { getSpecialistConfigs } from '../../src/services/llm-router/router-config';

// Mock da API para testes sem chamar OpenRouter de verdade
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  specialist: 'reasoning',
                  complexity: 'medium',
                  domain_tags: ['financeiro'],
                  reasoning: 'Cálculo financeiro requer DeepSeek R1',
                  formatted_task: 'Calcule o break-even do cliente',
                  confidence: 0.95,
                }),
              },
              finish_reason: 'stop',
            }],
          }),
        },
      },
    })),
  };
});

describe('CotTriage', () => {
  let triage: CotTriage;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    triage = new CotTriage();
  });

  it('deve retornar specialist válido', async () => {
    const result = await triage.classify('Calcule o break-even do cliente Paroma');
    const validSpecialists = ['reasoning', 'agentic', 'text', 'fast', 'longoutput', 'code', 'fallback'];
    expect(validSpecialists).toContain(result.specialist);
  });

  it('deve retornar fallback determinístico quando API falha', async () => {
    const { OpenAI } = require('openai');
    OpenAI.mockImplementationOnce(() => ({
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API error')) } }
    }));

    const fallbackTriage = new CotTriage();
    const result = await fallbackTriage.classify('debug this code');
    expect(result.specialist).toBe('code');
    expect(result.domain_tags).toContain('fallback-deterministic');
  });

  it('deve mapear keyword "n8n" para agentic', async () => {
    // Forçar fallback para testar mapeamento determinístico
    const { OpenAI } = require('openai');
    OpenAI.mockImplementationOnce(() => ({
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('forced')) } }
    }));

    const t = new CotTriage();
    const result = await t.classify('crie um workflow n8n para enviar mensagem');
    expect(result.specialist).toBe('agentic');
  });
});

describe('RouterConfig', () => {
  it('deve ter todos os especialistas configurados', () => {
    const configs = getSpecialistConfigs();
    const required = ['reasoning', 'agentic', 'text', 'fast', 'longoutput', 'code', 'fallback'];
    required.forEach(key => {
      expect(configs[key as keyof typeof configs]).toBeDefined();
      expect(configs[key as keyof typeof configs].model_id).toBeTruthy();
      expect(configs[key as keyof typeof configs].system_prompt).toBeTruthy();
    });
  });
});
```

---

## CHECKLIST DE EXECUÇÃO — Claude Code

Execute nesta ordem exata:

```
FASE 1: RECONHECIMENTO (obrigatório — não pular)
─────────────────────────────────────────────────
[ ] 1. cat src/core/providers/base-provider.ts
[ ] 2. cat src/core/providers/provider-factory.ts
[ ] 3. cat src/core/providers/deepseek-provider.ts
[ ] 4. grep -r "DEFAULT_PROVIDER\|selectProvider\|getProvider" src/ --include="*.ts" -n
[ ] 5. cat src/index.ts | head -100
[ ] 6. cat src/core/agent-loop/agent-loop.ts | head -80

FASE 2: NOVOS ARQUIVOS
─────────────────────────────────────────────────
[ ] 7.  Criar src/types/routing-types.ts           (Passo 2)
[ ] 8.  mkdir -p src/services/llm-router
[ ] 9.  Criar src/services/llm-router/router-config.ts   (Passo 3)
[ ] 10. Criar src/services/llm-router/router-logger.ts   (Passo 4)
[ ] 11. Criar src/services/llm-router/cot-triage.ts      (Passo 5)
[ ] 12. Criar src/core/providers/openrouter-provider.ts  (Passo 6)

FASE 3: MODIFICAÇÕES (adaptadas ao código real encontrado)
─────────────────────────────────────────────────
[ ] 13. Adicionar variáveis ao .env                (Passo 1)
[ ] 14. Modificar provider-factory.ts              (Passo 7)
[ ] 15. Adicionar comando /routing                 (Passo 8)

FASE 4: VALIDAÇÃO
─────────────────────────────────────────────────
[ ] 16. npm run build — verificar 0 erros TypeScript
[ ] 17. Criar tests/unit/llm-router.test.ts        (Passo 9)
[ ] 18. npm run test:unit -- --testPathPattern=llm-router
[ ] 19. ROUTER_COT_ENABLED=false npm run dev       (teste com feature flag OFF)
[ ] 20. ROUTER_COT_ENABLED=true npm run dev        (teste com feature flag ON)
```

---

## SAFE ROLLBACK

Se algo quebrar, reverter é simples:

```bash
# Desativa o novo routing sem tocar em código
echo "ROUTER_COT_ENABLED=false" >> .env

# O provider-factory.ts volta para a lógica original
# Nenhum arquivo existente foi deletado
```

---

## NOTAS PARA O CLAUDE CODE

**1. Adaptar interfaces ao código real.**
Os tipos `ProviderMessage`, `ProviderResponse` e `ToolDefinition` existem no projeto com nomes que podem diferir. Ler `base-provider.ts` é obrigatório antes de criar `openrouter-provider.ts`.

**2. O cost tracker pode precisar de ajuste.**
O GueClaw rastreia custos por modelo. Se `cost-tracker` usar `provider.getModel()` ou similar, adicionar esse getter no `OpenRouterProvider` usando `getCurrentModelId()`.

**3. O MCP SDK já está instalado.**
`@modelcontextprotocol/sdk` está no `package.json`. Se o projeto usar MCP tools que precisam de contexto do provider, verificar se `openrouter-provider.ts` precisa passar informações de contexto adicionais.

**4. O `response_format: { type: 'json_object' }` requer suporte do modelo.**
DeepSeek R1 suporta. Se o triageModel for trocado para outro, verificar compatibilidade antes.

**5. Não criar arquivos de prompt externos.**
Os system prompts estão inline em `router-config.ts` — mais fácil de manter e sem dependência de paths de arquivo.

---

*Plano gerado com base na análise do repositório `Moisesjr20/gueclaw` · Kyrius Consulting · kyrius.com.br*
