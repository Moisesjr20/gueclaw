'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { apiFetch, apiPost } from '@/lib/api';
import type { CampaignStats, QueueLead } from '@/lib/api';
import StatCard from '@/components/StatCard';
import CampaignProgress from '@/components/CampaignProgress';
import LeadQueue from '@/components/LeadQueue';
import { pct, relativeTime } from '@/lib/utils';

export default function CampaignPage() {
  const [acting, setActing] = useState<'pause' | 'resume' | null>(null);

  const {
    data: campaign,
    error,
    isLoading,
    mutate,
  } = useSWR<CampaignStats>('campaign', () => apiFetch<CampaignStats>('campaign'), {
    refreshInterval: 30_000,
  });

  const { data: queue } = useSWR<QueueLead[]>(
    'campaign/queue',
    () => apiFetch<QueueLead[]>('campaign/queue?limit=25'),
    { refreshInterval: 60_000 },
  );

  const slotsToday = campaign?.workerState.sent_slots ?? [];
  const allFired = slotsToday.length >= 4;

  async function handlePause() {
    setActing('pause');
    await apiPost('campaign/pause').catch(() => null);
    await mutate();
    setActing(null);
  }

  async function handleResume() {
    setActing('resume');
    await apiPost('campaign/resume').catch(() => null);
    await mutate();
    setActing(null);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Campanha WhatsApp</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">Disparos automáticos via leads.db</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handlePause}
            disabled={acting !== null || allFired}
            className="px-4 py-2 rounded-lg text-sm border border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/10 disabled:opacity-40 transition-all"
          >
            {acting === 'pause' ? '…' : 'Pausar dia'}
          </button>
          <button
            onClick={handleResume}
            disabled={acting !== null}
            className="px-4 py-2 rounded-lg text-sm border border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/10 disabled:opacity-40 transition-all"
          >
            {acting === 'resume' ? '…' : 'Retomar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass border-[#ef4444]/30 p-4 text-[#ef4444] text-sm">
          Falha ao buscar dados da campanha
        </div>
      )}

      {/* KPI row */}
      {!isLoading && campaign && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total leads" value={campaign.total} accent="blue" />
            <StatCard label="Enviados" value={campaign.sent} accent="green" />
            <StatCard label="Pendentes" value={campaign.pending} accent="amber" />
            <StatCard
              label="Com WhatsApp"
              value={`${campaign.hasWa}`}
              sub={`${pct(campaign.hasWa, campaign.total)}% do total`}
              accent="blue"
            />
          </div>

          <CampaignProgress stats={campaign} />

          {/* Recent sends */}
          {campaign.lastSent.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[#8fa8c8] uppercase tracking-wider">
                Últimos enviados
              </h2>
              <div className="glass overflow-hidden">
                <div className="divide-y divide-[rgba(59,130,246,0.07)]">
                  {campaign.lastSent.map((s, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm">
                      <span className="flex-1 text-[#c5d5e8] truncate">{s.title}</span>
                      <span className="font-mono text-xs text-[#3b82f6]">{s.whatsapp_number}</span>
                      <span className="text-xs text-[#5c7a9e]">{relativeTime(s.sent_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Lead queue */}
      {queue && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[#8fa8c8] uppercase tracking-wider">
            Próximos na fila ({queue.length})
          </h2>
          <LeadQueue leads={queue} />
        </section>
      )}
    </div>
  );
}
