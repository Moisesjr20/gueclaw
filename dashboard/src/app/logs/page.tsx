'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { LogTail } from '@/lib/api';
import { RefreshCw, Search, X } from 'lucide-react';

const LEVELS = ['ALL', 'ERROR', 'WARN', 'INFO', 'SUCCESS'] as const;
type Level = (typeof LEVELS)[number];

const LINE_OPTIONS = [60, 120, 300, 500];

const levelStyle: Record<Level, string> = {
  ALL:     'bg-white/5 text-[#8fa8c8] hover:bg-white/10',
  ERROR:   'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  WARN:    'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
  INFO:    'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
};

const levelActiveStyle: Record<Level, string> = {
  ALL:     'bg-white/15 text-[#e2eaf7]',
  ERROR:   'bg-red-500/25 text-red-300',
  WARN:    'bg-amber-500/25 text-amber-300',
  INFO:    'bg-blue-500/25 text-blue-300',
  SUCCESS: 'bg-emerald-500/25 text-emerald-300',
};

function lineColor(line: string): string {
  const l = line.toLowerCase();
  if (/error|❌|fail|exception/i.test(l)) return 'text-red-400';
  if (/warn|⚠️/i.test(l))                 return 'text-amber-400';
  if (/✅|success|started|connected/i.test(l)) return 'text-emerald-400';
  if (/info|\[info\]/i.test(l))            return 'text-blue-300';
  return 'text-[#8fa8c8]';
}

function matchesLevel(line: string, level: Level): boolean {
  if (level === 'ALL') return true;
  const l = line.toLowerCase();
  if (level === 'ERROR')   return /error|❌|fail|exception/i.test(l);
  if (level === 'WARN')    return /warn|⚠️/i.test(l);
  if (level === 'SUCCESS') return /✅|success|started|connected/i.test(l);
  if (level === 'INFO')    return /info|\[info\]/i.test(l);
  return true;
}

export default function LogsPage() {
  const [level, setLevel]     = useState<Level>('ALL');
  const [search, setSearch]   = useState('');
  const [lineCount, setLineCount] = useState(120);

  const { data, isLoading, mutate } = useSWR<LogTail>(
    `logs-${lineCount}`,
    () => apiFetch<LogTail>(`logs/tail?lines=${lineCount}`),
    { refreshInterval: 15_000 },
  );

  const filteredLines = useMemo(() => {
    if (!data?.lines) return [];
    return data.lines.filter((line) => {
      if (!matchesLevel(line, level)) return false;
      if (search.trim() && !line.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, level, search]);

  const counts = useMemo(() => {
    if (!data?.lines) return { ERROR: 0, WARN: 0, INFO: 0, SUCCESS: 0 };
    return {
      ERROR:   data.lines.filter(l => /error|❌|fail|exception/i.test(l)).length,
      WARN:    data.lines.filter(l => /warn|⚠️/i.test(l)).length,
      INFO:    data.lines.filter(l => /info|\[info\]/i.test(l)).length,
      SUCCESS: data.lines.filter(l => /✅|success|started|connected/i.test(l)).length,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Logs</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">
            Actualização automática a cada 15s
            {data?.path && <span className="font-mono ml-2 text-xs">· {data.path}</span>}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs text-[#3b5270] hover:text-[#3b82f6] transition-colors"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          refresh
        </button>
      </div>

      {/* Controls */}
      <div className="glass p-3 flex flex-wrap gap-3 items-center">
        {/* Level filters */}
        <div className="flex gap-1.5 flex-wrap">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                level === l ? levelActiveStyle[l] : levelStyle[l]
              }`}
            >
              {l}
              {l !== 'ALL' && counts[l] > 0 && (
                <span className="ml-1.5 opacity-75">({counts[l]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5c7a9e]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por texto..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-xs text-[#e2eaf7] placeholder-[#5c7a9e] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5c7a9e] hover:text-[#e2eaf7]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Line count */}
        <select
          value={lineCount}
          onChange={(e) => setLineCount(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[#8fa8c8] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        >
          {LINE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} linhas</option>
          ))}
        </select>

        <span className="text-xs text-[#3b5270]">
          {filteredLines.length}/{data?.lines.length ?? 0} linhas
        </span>
      </div>

      {/* Log output */}
      {isLoading && (
        <div className="glass h-96 animate-pulse bg-[#0e1522]/50 rounded-xl" />
      )}

      {!isLoading && !data && (
        <div className="glass p-10 text-center text-[#ef4444] text-sm">
          Falha ao carregar logs
        </div>
      )}

      {filteredLines.length === 0 && data && !isLoading && (
        <div className="glass p-10 text-center text-[#5c7a9e] text-sm">
          Nenhuma linha corresponde ao filtro
        </div>
      )}

      {filteredLines.length > 0 && (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
            <div className="font-mono text-xs p-4 space-y-0.5">
              {filteredLines.map((line, i) => (
                <div key={i} className={`leading-5 hover:bg-white/[0.03] px-1 rounded ${lineColor(line)}`}>
                  <span className="text-[#3b5270] select-none mr-3">
                    {String(i + 1).padStart(4, ' ')}
                  </span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
