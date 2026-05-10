import { RouterCategory } from '../../types/routing-types';

export interface SpecialistModels {
  reasoning: string;
  agentic: string;
  text: string;
  fast: string;
  longoutput: string;
  code: string;
  fallback: string;
}

export function getSpecialistModels(): SpecialistModels {
  return {
    reasoning:  process.env.ROUTER_MODEL_REASONING  || 'deepseek/deepseek-r1',
    agentic:    process.env.ROUTER_MODEL_AGENTIC    || 'moonshotai/kimi-k2',
    text:       process.env.ROUTER_MODEL_TEXT       || 'qwen/qwen3-235b-a22b',
    fast:       process.env.ROUTER_MODEL_FAST       || 'google/gemma-3-27b-it',
    longoutput: process.env.ROUTER_MODEL_LONGOUTPUT || 'thudm/glm-z1-32b',
    code:       process.env.ROUTER_MODEL_CODE       || 'deepseek/deepseek-r1',
    fallback:   process.env.ROUTER_MODEL_FALLBACK   || 'deepseek/deepseek-chat-v3-0324',
  };
}

export function modelForCategory(category: RouterCategory, models: SpecialistModels): string {
  return models[category] ?? models.fallback;
}

export const TRIAGE_SYSTEM_PROMPT = `You are a message classifier. Analyze the user message and output ONLY a JSON object — no extra text.

Categories:
- "reasoning"   : Multi-step deduction, math, logical analysis, comparisons, strategic plans
- "agentic"     : Tool use, file ops, shell commands, docker, API calls, automation tasks
- "text"        : Writing, translation, summarization, editing, creative content
- "fast"        : Greetings, trivial factual questions, single-sentence lookups
- "longoutput"  : Requests that need very long or detailed output (reports, full code files)
- "code"        : Code generation, debugging, architecture, refactoring, code review
- "fallback"    : Unclear or mixed intent

Respond with exactly this JSON (no markdown, no prose):
{"category":"<one of the above>","confidence":<0.0-1.0>,"reasoning":"<one short sentence>"}`;
