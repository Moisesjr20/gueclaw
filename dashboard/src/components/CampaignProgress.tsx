import { pct } from '@/lib/utils';
import type { CampaignStats } from '@/lib/api';

const SLOTS = [9, 12, 15, 18];

export default function CampaignProgress({ stats }: { stats: CampaignStats }) {
  const progress = pct(stats.sent, stats.total);
  const firedSlots = stats.workerState.sent_slots ?? [];

  return (
    <div className="glass p-5 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#e2eaf7]">Progresso da Campanha</span>
        <span className="font-mono text-sm text-[#3b82f6]">
          {stats.sent} / {stats.total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[#0e1522] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#3b82f6] to-[#10b981] rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#5c7a9e]">
        <span>{progress}% enviado</span>
        <span>{stats.pending} pendentes</span>
      </div>

      {/* Daily slots */}
      <div>
        <div className="text-xs text-[#5c7a9e] mb-2">Slots do dia ({stats.workerState.date ?? '—'})</div>
        <div className="flex gap-3">
          {SLOTS.map((h) => {
            const fired = firedSlots.includes(h);
            return (
              <div
                key={h}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs font-mono ${
                  fired
                    ? 'border-[#10b981]/40 text-[#10b981] bg-[#10b981]/5'
                    : 'border-[rgba(59,130,246,0.15)] text-[#5c7a9e]'
                }`}
              >
                <span>{h}h</span>
                <span>{fired ? '✓' : '·'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
