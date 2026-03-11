/**
 * Interfaces e tipos do sistema de Sub-Agentes DOE.
 * Sub-agentes são instâncias isoladas do AgentLoop, criadas
 * pelo agente principal para executar tarefas de forma autônoma.
 */

export interface SubAgentConfig {
  /** ID único do sub-agente (UUID gerado em runtime) */
  id: string;
  /** Nome descritivo para identificação nos relatórios */
  name: string;
  /** Tarefa que o sub-agente deve executar */
  task: string;
  /** ID do usuário/agente que criou este sub-agente */
  createdBy: string;
  /**
   * System prompt customizado para o sub-agente.
   * Se omitido, usa o prompt DOE padrão do agente pai.
   */
  systemPromptOverride?: string;
}

export interface SubAgentRunResult {
  /** ID do run no banco SQLite */
  runId: number;
  /** ID do sub-agente */
  agentId: string;
  /** Status final */
  status: 'completed' | 'failed';
  /** Resposta gerada pelo AgentLoop */
  result?: string;
  /** Mensagem de erro (se failed) */
  error?: string;
  /** Duração da execução em ms */
  durationMs: number;
}
