export type RouterCategory =
  | 'reasoning'
  | 'agentic'
  | 'text'
  | 'fast'
  | 'longoutput'
  | 'code'
  | 'fallback';

export interface TriageDecision {
  category: RouterCategory;
  model: string;
  confidence: number;
  reasoning?: string;
  elapsedMs?: number;
  usedCot: boolean;
}
