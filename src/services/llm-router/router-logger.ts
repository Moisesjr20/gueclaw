import { TriageDecision } from '../../types/routing-types';

export function logTriageDecision(message: string, decision: TriageDecision): void {
  const preview = message.slice(0, 60).replace(/\n/g, ' ');
  const flags = [
    decision.usedCot ? 'CoT' : 'heuristic',
    `${Math.round((decision.confidence ?? 0) * 100)}%`,
    decision.elapsedMs != null ? `${decision.elapsedMs}ms` : '',
  ].filter(Boolean).join(' ');

  console.log(
    `🔀 Router [${decision.category}] → ${decision.model}  (${flags})\n` +
    `   msg: "${preview}${message.length > 60 ? '…' : ''}"`
  );
}
