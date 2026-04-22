/**
 * Erro recuperável que pode ser retomado pelo usuário
 */
export class RecoverableError extends Error {
  public readonly errorType: 'MAX_ITERATIONS' | 'UNEXPECTED_ERROR' | 'TOOL_ERROR';
  public readonly attemptedAction?: string;
  public readonly conversationHistory?: any[];
  
  constructor(
    message: string, 
    errorType: 'MAX_ITERATIONS' | 'UNEXPECTED_ERROR' | 'TOOL_ERROR',
    attemptedAction?: string,
    conversationHistory?: any[]
  ) {
    super(message);
    this.name = 'RecoverableError';
    this.errorType = errorType;
    this.attemptedAction = attemptedAction;
    this.conversationHistory = conversationHistory;
  }
}

/**
 * Erro de limite de iterações atingido
 */
export class MaxIterationsError extends RecoverableError {
  constructor(maxIterations: number, attemptedTools: string, conversationHistory?: any[]) {
    const message = (
      `I apologize, but I reached the maximum number of reasoning steps (${maxIterations}) ` +
      `before completing the task.\n\n` +
      `**What I was trying to do:**\n` +
      `I wanted to execute: ${attemptedTools}\n\n` +
      `**What you can do:**\n` +
      `1. Try breaking the task into smaller, more specific steps\n` +
      `2. Provide more details or clarify what you need\n` +
      `3. If this is a complex task, consider asking for just one part at a time\n\n` +
      `**Technical details:** The agent is limited to ${maxIterations} iterations to prevent infinite loops.`
    );
    
    super(message, 'MAX_ITERATIONS', attemptedTools, conversationHistory);
  }
}
