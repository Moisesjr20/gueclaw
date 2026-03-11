import { Tool } from '../engine/ToolRegistry';
import { SubAgentManager } from '../subagents/SubAgentManager';
import { SubAgent, SubAgentRun } from '../memory/MemoryManager';

/**
 * SubAgentStatusTool — Tool de Consulta (Layer 3, DOE)
 *
 * Permite ao agente principal consultar o status de um sub-agente
 * ou listar todos os sub-agentes registrados.
 */
export function createSubAgentStatusTool(manager: SubAgentManager): Tool {
  return {
    name: 'get_sub_agent_status',
    description:
      'Consulta o status de um sub-agente específico (por agent_id) ou lista todos os sub-agentes ' +
      'com seus respectivos status. Use após spawn_sub_agent para monitorar a execução.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description:
            '(Opcional) ID do sub-agente retornado por spawn_sub_agent. ' +
            'Se omitido, retorna a lista de todos os sub-agentes.',
        },
      },
      required: [],
    },

    async execute(args: { agent_id?: string }): Promise<string> {
      const result = manager.getStatus(args.agent_id);

      // Lista todos
      if (!args.agent_id) {
        const agents = result as SubAgent[];
        if (agents.length === 0) {
          return '[SubAgentStatus] Nenhum sub-agente registrado ainda.';
        }

        const summary = agents.map(a => ({
          id: a.id,
          name: a.name,
          status: a.status,
          created_at: new Date(a.created_at).toLocaleString('pt-BR'),
        }));

        return JSON.stringify({ total: agents.length, agents: summary }, null, 2);
      }

      // Agente específico
      const { agent, runs } = result as { agent: SubAgent | null; runs: SubAgentRun[] };

      if (!agent) {
        return `[SubAgentStatus] Sub-agente "${args.agent_id}" não encontrado.`;
      }

      const latestRun = runs[0] ?? null;

      return JSON.stringify({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        created_by: agent.created_by,
        created_at: new Date(agent.created_at).toLocaleString('pt-BR'),
        latest_run: latestRun
          ? {
              run_id: latestRun.id,
              status: latestRun.status,
              task: latestRun.task,
              started_at: new Date(latestRun.started_at).toLocaleString('pt-BR'),
              finished_at: latestRun.finished_at
                ? new Date(latestRun.finished_at).toLocaleString('pt-BR')
                : null,
              duration_seconds: latestRun.finished_at
                ? ((latestRun.finished_at - latestRun.started_at) / 1000).toFixed(1)
                : null,
              result_preview: latestRun.result
                ? latestRun.result.slice(0, 300) + (latestRun.result.length > 300 ? '...' : '')
                : null,
              error: latestRun.error ?? null,
            }
          : null,
        total_runs: runs.length,
      }, null, 2);
    },
  };
}
