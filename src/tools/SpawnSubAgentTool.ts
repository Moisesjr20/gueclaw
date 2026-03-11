import { Tool } from '../engine/ToolRegistry';
import { SubAgentManager } from '../subagents/SubAgentManager';
import * as crypto from 'crypto';

/**
 * SpawnSubAgentTool — Tool de Execução (Layer 3, DOE)
 *
 * Permite ao agente principal criar e disparar um sub-agente
 * para executar uma tarefa de forma autônoma e assíncrona.
 *
 * O sub-agente roda com seu próprio AgentLoop isolado e registra
 * tudo no SQLite. Use get_sub_agent_status para acompanhar.
 */
export function createSpawnSubAgentTool(manager: SubAgentManager, createdBy: string): Tool {
  return {
    name: 'spawn_sub_agent',
    description:
      'Cria e dispara um sub-agente como uma tarefa autônoma e assíncrona. ' +
      'O sub-agente executa com um AgentLoop próprio e registra tudo no banco. ' +
      'Retorna o agent_id para rastreamento via get_sub_agent_status.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nome descritivo do sub-agente (ex: "Coleta de Dados", "Análise de Logs")',
        },
        task: {
          type: 'string',
          description: 'Descrição completa da tarefa que o sub-agente deve executar. Seja específico.',
        },
        system_prompt_override: {
          type: 'string',
          description:
            '(Opcional) Instruções adicionais de comportamento para o sub-agente. ' +
            'Complementa o prompt DOE padrão.',
        },
      },
      required: ['name', 'task'],
    },

    async execute(args: { name: string; task: string; system_prompt_override?: string }): Promise<string> {
      if (!args.name || !args.task) {
        return '[SpawnSubAgent] Erro: os campos "name" e "task" são obrigatórios.';
      }

      const agentId = crypto.randomUUID();

      const spawnedId = manager.spawn({
        id: agentId,
        name: args.name,
        task: args.task,
        createdBy,
        systemPromptOverride: args.system_prompt_override,
      });

      return JSON.stringify({
        ok: true,
        message: `Sub-agente "${args.name}" criado e em execução.`,
        agent_id: spawnedId,
        tip: 'Use get_sub_agent_status com este agent_id para acompanhar a execução.',
      }, null, 2);
    },
  };
}
