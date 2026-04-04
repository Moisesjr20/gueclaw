'use client';

import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Play, Zap } from 'lucide-react';

interface SkillExecution {
  id: string;
  skill_name: string;
  status: 'running' | 'success' | 'error';
  started_at: string;
  duration_ms?: number;
  tools_used?: string[];
}

const nodeTypes = {
  skill: SkillNode,
  tool: ToolNode,
};

function SkillNode({ data }: { data: any }) {
  return (
    <div className="glass px-4 py-3 rounded-lg border-2 border-blue-500/30 min-w-[180px]">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-blue-400" />
        <div className="font-semibold text-sm text-blue-300">Skill</div>
      </div>
      <div className="text-sm text-[#e2eaf7] font-mono">{data.label}</div>
      {data.status && (
        <div className="mt-2 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              data.status === 'running'
                ? 'bg-yellow-400 animate-pulse'
                : data.status === 'success'
                ? 'bg-green-400'
                : 'bg-red-400'
            }`}
          />
          <span className="text-xs text-[#5c7a9e]">
            {data.status === 'running' ? 'Rodando...' : data.status}
          </span>
        </div>
      )}
    </div>
  );
}

function ToolNode({ data }: { data: any }) {
  return (
    <div className="glass px-3 py-2 rounded border border-purple-500/20 min-w-[140px]">
      <div className="text-xs text-purple-300 mb-0.5">Tool</div>
      <div className="text-sm text-[#c5d5e8] font-mono">{data.label}</div>
    </div>
  );
}

export default function WorkflowsPage() {
  const fetcher = async () => {
    try {
      return await apiFetch<SkillExecution[]>('skills/executions/recent');
    } catch {
      return [];
    }
  };

  const { data: executions, isLoading } = useSWR<SkillExecution[]>(
    'skills/executions/recent',
    fetcher,
    { refreshInterval: 5000 },
  );

  // Converter execuções em nodes/edges
  const buildFlowFromExecutions = useCallback((execs: SkillExecution[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yOffset = 0;

    execs.slice(0, 5).forEach((exec) => {
      // Skill node
      nodes.push({
        id: `skill-${exec.id}`,
        type: 'skill',
        position: { x: 50, y: yOffset },
        data: {
          label: exec.skill_name,
          status: exec.status,
          duration: exec.duration_ms,
        },
      });

      // Tools usadas
      exec.tools_used?.forEach((tool, toolIdx) => {
        const toolId = `tool-${exec.id}-${toolIdx}`;
        nodes.push({
          id: toolId,
          type: 'tool',
          position: { x: 300, y: yOffset + toolIdx * 60 },
          data: { label: tool },
        });

        edges.push({
          id: `edge-${exec.id}-${toolIdx}`,
          source: `skill-${exec.id}`,
          target: toolId,
          animated: exec.status === 'running',
          style: { stroke: exec.status === 'success' ? '#10b981' : '#6366f1' },
        });
      });

      yOffset += Math.max(120, (exec.tools_used?.length || 0) * 60);
    });

    return { nodes, edges };
  }, []);

  const initialFlow = buildFlowFromExecutions(executions || []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  // Atualizar flow quando dados mudarem
  useEffect(() => {
    if (executions) {
      const newFlow = buildFlowFromExecutions(executions);
      setNodes(newFlow.nodes);
      setEdges(newFlow.edges);
    }
  }, [executions, buildFlowFromExecutions, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Workflows</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">
            Visualização de execução de skills e tools em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="glass px-4 py-2 rounded-lg text-sm text-[#3b82f6] hover:bg-white/[0.05] flex items-center gap-2">
            <Play className="w-4 h-4" />
            Executar Skill
          </button>
          {isLoading && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="glass rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#0a1628]"
        >
          <Background color="#1e3a5f" gap={16} />
          <Controls className="glass" />
          <MiniMap
            className="glass"
            nodeColor={(node) => {
              if (node.type === 'skill') return '#3b82f6';
              if (node.type === 'tool') return '#a855f7';
              return '#6b7280';
            }}
          />
        </ReactFlow>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatBox
          label="Skills Executadas"
          value={executions?.length.toString() || '0'}
          color="blue"
        />
        <StatBox
          label="Em Execução"
          value={executions?.filter((e) => e.status === 'running').length.toString() || '0'}
          color="yellow"
        />
        <StatBox
          label="Taxa de Sucesso"
          value={
            executions?.length
              ? `${Math.round(
                  (executions.filter((e) => e.status === 'success').length / executions.length) *
                    100,
                )}%`
              : '—'
          }
          color="green"
        />
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = {
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
  };

  return (
    <div className="glass p-4 rounded-lg">
      <div className={`text-2xl font-bold ${colors[color as keyof typeof colors]}`}>{value}</div>
      <div className="text-sm text-[#5c7a9e] mt-1">{label}</div>
    </div>
  );
}
