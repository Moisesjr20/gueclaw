# Entrega - FluxoHub (Code-First + Supabase)

## 1) Schema SQL (Supabase)
```sql
-- Extensões úteis
create extension if not exists "pgcrypto";

-- Tabela: workflows
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela: nodes
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  node_type text not null,
  label text,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  code text,
  input_schema jsonb,
  output_schema jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela: edges
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.nodes(id) on delete cascade,
  target_node_id uuid not null references public.nodes(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edges_unique unique (workflow_id, source_node_id, target_node_id)
);

-- Tabela: executions
create table if not exists public.executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','running','success','failed','cancelled')),
  input_payload jsonb,
  output_payload jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela: execution_logs
create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  node_id uuid references public.nodes(id) on delete set null,
  level text not null default 'info',
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_workflows
before update on public.workflows
for each row execute function public.set_updated_at();

create trigger set_updated_at_nodes
before update on public.nodes
for each row execute function public.set_updated_at();

create trigger set_updated_at_edges
before update on public.edges
for each row execute function public.set_updated_at();

create trigger set_updated_at_executions
before update on public.executions
for each row execute function public.set_updated_at();

-- RLS
alter table public.workflows enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.executions enable row level security;
alter table public.execution_logs enable row level security;

-- Policies
create policy "workflows_owner"
on public.workflows
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "nodes_owner"
on public.nodes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "edges_owner"
on public.edges
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "executions_owner"
on public.executions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "execution_logs_owner"
on public.execution_logs
for all
using (
  exists (
    select 1 from public.executions e
    where e.id = execution_id and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.executions e
    where e.id = execution_id and e.user_id = auth.uid()
  )
);
```

## 2) Estrutura de Dados do React Flow
```ts
type DbNode = {
  id: string;
  node_type: string;
  label?: string;
  position_x: number;
  position_y: number;
  code?: string;
  input_schema?: any;
  output_schema?: any;
};

type DbEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
};

const toReactFlowNodes = (rows: DbNode[]) =>
  rows.map((n) => ({
    id: n.id,
    type: n.node_type,
    position: { x: Number(n.position_x), y: Number(n.position_y) },
    data: {
      label: n.label ?? n.node_type,
      code: n.code,
      inputSchema: n.input_schema,
      outputSchema: n.output_schema,
    },
  }));

const toReactFlowEdges = (rows: DbEdge[]) =>
  rows.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label,
  }));
```

## 3) Lógica do Orchestrator (Supabase Edge Function)
```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type NodeRow = {
  id: string;
  workflow_id: string;
  node_type: string;
  code: string | null;
};

type EdgeRow = {
  source_node_id: string;
  target_node_id: string;
};

serve(async (req) => {
  const { workflowId, input } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    supabase.from("nodes").select("*").eq("workflow_id", workflowId),
    supabase.from("edges").select("*").eq("workflow_id", workflowId),
  ]);

  if (!nodes || !edges) {
    return new Response(JSON.stringify({ error: "Graph not found" }), { status: 404 });
  }

  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes as NodeRow[]) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges as EdgeRow[]) {
    inDeg.set(e.target_node_id, (inDeg.get(e.target_node_id) ?? 0) + 1);
    adj.get(e.source_node_id)!.push(e.target_node_id);
  }

  const queue = [...nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id)];
  const order: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const nxt of adj.get(id) || []) {
      inDeg.set(nxt, (inDeg.get(nxt) ?? 0) - 1);
      if ((inDeg.get(nxt) ?? 0) === 0) queue.push(nxt);
    }
  }

  const output: Record<string, unknown> = {};
  for (const nodeId of order) {
    const node = (nodes as NodeRow[]).find(n => n.id === nodeId);
    if (!node?.code) continue;

    const fn = new Function("input", "context", node.code);
    const result = await fn(input, { outputs: output, nodeId });
    output[nodeId] = result;
  }

  return new Response(JSON.stringify({ output }), {
    headers: { "content-type": "application/json" },
  });
});
```

## 4) System Prompt para Gemini
```text
Você é um gerador de código para Supabase Edge Functions (Deno runtime).
Regras:
- Retorne APENAS um objeto JSON válido com as chaves:
  { "title": string, "description": string, "code": string }
- O campo "code" deve conter apenas código JavaScript/TypeScript compatível com Deno.
- Não use bibliotecas Node.js nativas (fs, child_process, net).
- Use fetch para HTTP e APIs padrão da Web.
- O código deve ser uma função body que aceita (input, context) e retorna um resultado serializável.
- Evite imports, a menos que absolutamente necessário. Se usar, utilize URLs absolutas.
- Seja conciso, com tratamento de erros básico.
- Não inclua explicações fora do JSON.

Exemplo de assinatura esperada no code:
const result = await doSomething(input);
return result;
```
