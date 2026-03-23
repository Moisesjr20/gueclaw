'use client';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { Pm2Process, SkillStats } from '@/lib/api';
import ProcessCard from '@/components/ProcessCard';
import StatCard from '@/components/StatCard';
import { RefreshCw } from 'lucide-react';

export default function OverviewPage() {
  const { data: processes, error: pmErr, isLoading: pmLoading } = useSWR<Pm2Process[]>(
    'pm2/status',
    () => apiFetch<Pm2Process[]>('pm2/status'),
    { refreshInterval: 30_000 },
  );

  const { data: stats, isLoading: statsLoading } = useSWR<SkillStats>(
    'stats',
    () => apiFetch<SkillStats>('stats'),
    { refreshInterval: 60_000 },
  );

  const online = processes?.filter((p) => p.status === 'online').length ?? 0;
  const total = processes?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Overview</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">Processos activos e estatísticas do agente</p>
        </div>
        <RefreshingBadge />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Processos online" value={pmLoading ? '…' : `${online}/${total}`} accent="green" />
        <StatCard
          label="Skills executadas"
          value={statsLoading ? '…' : (stats?.skills.reduce((s, x) => s + x.total, 0) ?? '—')}
          accent="blue"
        />
        <StatCard
          label="Taxa de sucesso"
          value={
            statsLoading || !stats
              ? '…'
              : (() => {
                  const t = stats.skills.reduce((s, x) => s + x.total, 0);
                  const ok = stats.skills.reduce((s, x) => s + x.successes, 0);
                  return t ? `${Math.round((ok / t) * 100)}%` : '—';
                })()
          }
          accent="green"
        />
        <StatCard
          label="Conversas rastreadas"
          value={statsLoading ? '…' : (stats?.traces.traced_conversations ?? '—')}
          accent="blue"
        />
      </div>

      {/* PM2 processes */}
      <section className="space-y-3">
        <SectionTitle title="Processos PM2" />
        {pmErr && <ErrorBox msg="Falha ao buscar status PM2" />}
        {pmLoading && <PlaceholderCards n={2} />}
        {processes && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processes.map((p) => (
              <ProcessCard key={p.id} process={p} />
            ))}
          </div>
        )}
      </section>

      {/* Skills table */}
      <section className="space-y-3">
        <SectionTitle title="Execuções por Skill" />
        {statsLoading && <div className="text-sm text-[#5c7a9e]">Carregando…</div>}
        {stats && (
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(59,130,246,0.12)] text-xs text-[#5c7a9e] uppercase">
                  <th className="text-left px-4 py-3">Skill</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Sucesso</th>
                  <th className="text-right px-4 py-3">Avg ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(59,130,246,0.07)]">
                {stats.skills.map((s) => (
                  <tr key={s.skill_name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-[#3b82f6]">{s.skill_name}</td>
                    <td className="px-4 py-2.5 text-right text-[#c5d5e8]">{s.total}</td>
                    <td className="px-4 py-2.5 text-right text-[#10b981]">{s.successes}</td>
                    <td className="px-4 py-2.5 text-right text-[#5c7a9e] font-mono">{s.avg_ms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-medium text-[#8fa8c8] uppercase tracking-wider">{title}</h2>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="glass border-[#ef4444]/30 p-4 text-[#ef4444] text-sm">{msg}</div>
  );
}

function PlaceholderCards({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="glass p-5 h-36 animate-pulse bg-[#0e1522]/50" />
      ))}
    </div>
  );
}

function RefreshingBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#3b5270]">
      <RefreshCw size={11} />
      <span>auto 30s</span>
    </div>
  );
}
