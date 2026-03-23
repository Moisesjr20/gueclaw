// Client-side SWR fetcher — calls Next.js proxy routes (never the VPS directly)

export async function apiFetch<T>(path: string): Promise<T> {
  const url = `/api/${path.replace(/^\/+/, '')}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = `/api/${path.replace(/^\/+/, '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Pm2Process {
  id: number;
  name: string;
  status: 'online' | 'stopped' | 'errored' | 'launching' | string;
  restarts: number;
  uptime: number | null;
  memoryBytes: number;
  cpu: number;
}

export interface CampaignStats {
  total: number;
  sent: number;
  pending: number;
  hasWa: number;
  lastSent: { title: string; whatsapp_number: string; sent_at: string }[];
  workerState: {
    date?: string;
    sent_count?: number;
    sent_slots?: number[];
  };
}

export interface QueueLead {
  id: number;
  title: string;
  city: string;
  whatsapp_number: string;
}

export interface SkillStats {
  skills: { skill_name: string; total: number; successes: number; avg_ms: number }[];
  traces: { traced_conversations: number; total_traces: number; tool_call_rate: number };
}

export interface Conversation {
  id: string;
  user_id: string;
  provider: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface LogTail {
  path: string;
  lines: string[];
}
