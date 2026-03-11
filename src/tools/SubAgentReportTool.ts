import { Tool } from '../engine/ToolRegistry';
import { SubAgentManager } from '../subagents/SubAgentManager';

/**
 * SubAgentReportTool — Tool de Relatório (Layer 3, DOE)
 *
 * Gera um relatório Markdown formatado com o histórico de execuções
 * dos sub-agentes, incluindo métricas de sucesso e detalhes de falhas.
 */
export function createSubAgentReportTool(manager: SubAgentManager): Tool {
  return {
    name: 'generate_sub_agent_report',
    description:
      'Gera um relatório detalhado em Markdown com o histórico de execuções dos sub-agentes. ' +
      'Inclui resumo executivo (total, sucesso, falhas), tabela de runs e detalhes de erros. ' +
      'Use quando o usuário solicitar relatório ou dados sobre sub-agentes.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description:
            '(Opcional) Filtra o relatório para um sub-agente específico. ' +
            'Se omitido, inclui todos os sub-agentes.',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de runs a incluir no relatório. Padrão: 20.',
        },
      },
      required: [],
    },

    async execute(args: { agent_id?: string; limit?: number }): Promise<string> {
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 20;

      const report = manager.generateReport(args.agent_id, limit);
      return report;
    },
  };
}
