import { formatBytes, formatUptime } from '@/lib/utils';
import type { Pm2Process } from '@/lib/api';
import { Activity, RefreshCw, Clock, HardDrive } from 'lucide-react';

interface ProcessCardProps {
  process: Pm2Process;
}

const statusStyle: Record<string, { dot: string; label: string; pulse: string }> = {
  online: { dot: 'bg-[#10b981]', label: 'online', pulse: 'pulse-green' },
  stopped: { dot: 'bg-[#ef4444]', label: 'stopped', pulse: 'pulse-red' },
  errored: { dot: 'bg-[#ef4444]', label: 'errored', pulse: 'pulse-red' },
};

export default function ProcessCard({ process: p }: ProcessCardProps) {
  const s = statusStyle[p.status] ?? { dot: 'bg-[#f59e0b]', label: p.status, pulse: '' };
  return (
    <div className="glass p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${s.dot} ${s.pulse} shrink-0`} />
          <span className="font-semibold text-[#e2eaf7]">{p.name}</span>
          <span className="text-xs text-[#3b5270] font-mono">#{p.id}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
            s.label === 'online'
              ? 'border-[#10b981]/40 text-[#10b981]'
              : 'border-[#ef4444]/40 text-[#ef4444]'
          }`}
        >
          {s.label}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricRow icon={<Clock size={13} />} label="Uptime" value={formatUptime(p.uptime)} />
        <MetricRow icon={<RefreshCw size={13} />} label="Restarts" value={String(p.restarts)} />
        <MetricRow icon={<HardDrive size={13} />} label="Mem" value={formatBytes(p.memoryBytes)} />
        <MetricRow icon={<Activity size={13} />} label="CPU" value={`${p.cpu}%`} />
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#3b5270]">{icon}</span>
      <span className="text-xs text-[#5c7a9e] min-w-[48px]">{label}</span>
      <span className="text-sm font-mono text-[#e2eaf7]">{value}</span>
    </div>
  );
}
