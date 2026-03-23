'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { Conversation } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

const PROVIDER_BADGE: Record<string, string> = {
  telegram: 'border-[#3b82f6]/40 text-[#3b82f6]',
  whatsapp: 'border-[#10b981]/40 text-[#10b981]',
};

export default function ConversationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, error } = useSWR<Conversation[]>(
    'conversations',
    () => apiFetch<Conversation[]>('conversations?limit=40'),
    { refreshInterval: 60_000 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e2eaf7]">Conversas</h1>
        <p className="text-sm text-[#5c7a9e] mt-0.5">Histórico de sessões do agente</p>
      </div>

      {error && (
        <div className="glass border-[#ef4444]/30 p-4 text-[#ef4444] text-sm">
          Falha ao carregar conversas
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-14 animate-pulse bg-[#0e1522]/50" />
          ))}
        </div>
      )}

      {data && (
        <div className="glass overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(59,130,246,0.12)] text-xs text-[#5c7a9e] uppercase tracking-wider grid grid-cols-[1fr_100px_80px_100px_20px] gap-4">
            <span>Usuário</span>
            <span>Provider</span>
            <span className="text-right">Msgs</span>
            <span className="text-right">Última act.</span>
            <span />
          </div>
          <div className="divide-y divide-[rgba(59,130,246,0.07)]">
            {data.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(selected === conv.id ? null : conv.id)}
                className="w-full text-left px-5 py-3 grid grid-cols-[1fr_100px_80px_100px_20px] gap-4 items-center text-sm hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-mono text-[#c5d5e8] truncate">{conv.user_id}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border w-fit ${
                    PROVIDER_BADGE[conv.provider] ?? 'border-[#5c7a9e]/40 text-[#5c7a9e]'
                  }`}
                >
                  {conv.provider}
                </span>
                <span className="text-right text-[#5c7a9e] font-mono">{conv.message_count}</span>
                <span className="text-right text-[#5c7a9e] text-xs">
                  {relativeTime(conv.updated_at)}
                </span>
                <ChevronRight
                  size={13}
                  className={`text-[#3b5270] transition-transform ${
                    selected === conv.id ? 'rotate-90' : ''
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="glass p-10 text-center text-[#5c7a9e] text-sm">Sem conversas registadas</div>
      )}
    </div>
  );
}
