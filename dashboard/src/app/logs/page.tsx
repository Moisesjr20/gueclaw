'use client';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { LogTail } from '@/lib/api';
import LogViewer from '@/components/LogViewer';
import { RefreshCw } from 'lucide-react';

export default function LogsPage() {
  const { data, isLoading, mutate } = useSWR<LogTail>(
    'logs',
    () => apiFetch<LogTail>('logs/tail?lines=120'),
    { refreshInterval: 15_000 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Logs</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">Últimas 120 linhas — actualização a cada 15s</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs text-[#3b5270] hover:text-[#3b82f6] transition-colors"
        >
          <RefreshCw size={12} />
          refresh
        </button>
      </div>

      {isLoading && (
        <div className="glass h-96 animate-pulse bg-[#0e1522]/50" />
      )}

      {data && (
        <>
          <LogViewer lines={data.lines} />
          {data.path && (
            <p className="text-xs text-[#3b5270] font-mono">{data.path}</p>
          )}
        </>
      )}

      {!isLoading && !data && (
        <div className="glass p-10 text-center text-[#ef4444] text-sm">
          Falha ao carregar logs
        </div>
      )}
    </div>
  );
}
