import axios from 'axios';
import { RouterCategory, TriageDecision } from '../../types/routing-types';
import {
  TRIAGE_SYSTEM_PROMPT,
  getSpecialistModels,
  modelForCategory,
} from './router-config';

const VALID_CATEGORIES: RouterCategory[] = [
  'reasoning', 'agentic', 'text', 'fast', 'longoutput', 'code', 'fallback',
];

function heuristicCategory(message: string): RouterCategory {
  const m = message.toLowerCase();
  if (m.length < 80 && /^(oi|olá|ola|bom dia|boa tarde|boa noite|hi|hello|hey|ok|obrigad)/i.test(m)) return 'fast';
  if (/\b(código|code|função|function|bug|debug|erro|error|refator|typescript|python|javascript|sql|api endpoint)\b/i.test(m)) return 'code';
  if (/\b(execut|roda|docker|shell|ssh|comando|arquivo|pasta|diretório|vps|server|deploy|container)\b/i.test(m)) return 'agentic';
  if (/\b(escreve|redija|traduza|resumo|resumir|relatório|escreva|artigo|texto)\b/i.test(m)) return 'text';
  if (m.length > 600 || /\b(completo|detalhado|lista completa|tudo sobre|explique tudo)\b/i.test(m)) return 'longoutput';
  if (/\b(analise|calcule|compare|explique|deduza|raciocine|prove|argumento)\b/i.test(m)) return 'reasoning';
  return 'fallback';
}

function stripThinkBlock(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseTriageJson(raw: string): { category: RouterCategory; confidence: number; reasoning?: string } | null {
  try {
    const cleaned = stripThinkBlock(raw);
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!VALID_CATEGORIES.includes(parsed.category)) return null;
    return {
      category: parsed.category as RouterCategory,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning,
    };
  } catch {
    return null;
  }
}

export class CotTriage {
  private static isEnabled(): boolean {
    return (
      process.env.ROUTER_COT_ENABLED === 'true' &&
      !!process.env.OPENROUTER_API_KEY
    );
  }

  static async classify(message: string): Promise<TriageDecision> {
    const models = getSpecialistModels();

    if (!this.isEnabled()) {
      const category = heuristicCategory(message);
      return {
        category,
        model: modelForCategory(category, models),
        confidence: 0.6,
        usedCot: false,
      };
    }

    const triageModel = process.env.ROUTER_TRIAGE_MODEL || 'deepseek/deepseek-r1';
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const apiKey = process.env.OPENROUTER_API_KEY!;

    const start = Date.now();
    try {
      const resp = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model: triageModel,
          messages: [
            { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
            { role: 'user', content: message.slice(0, 2000) },
          ],
          max_tokens: 256,
          temperature: 0,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        }
      );

      const raw: string = resp.data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseTriageJson(raw);
      const elapsed = Date.now() - start;

      if (parsed) {
        return {
          category: parsed.category,
          model: modelForCategory(parsed.category, models),
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
          elapsedMs: elapsed,
          usedCot: true,
        };
      }
    } catch (err: any) {
      console.warn(`⚠️ CoT triage failed (${err.message}), using heuristic fallback`);
    }

    // Heuristic fallback when CoT call fails or returns unparseable response
    const category = heuristicCategory(message);
    return {
      category,
      model: modelForCategory(category, models),
      confidence: 0.5,
      usedCot: false,
      elapsedMs: Date.now() - start,
    };
  }
}
