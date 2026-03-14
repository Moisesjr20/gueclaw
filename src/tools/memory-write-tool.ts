import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { PersistentMemory } from '../core/memory/persistent-memory';

/**
 * MemoryWriteTool — lets the LLM persist facts about the user across sessions.
 *
 * Usage:
 *   { "type": "permanent", "userId": "12345", "fact": "Prefere respostas curtas." }
 *   { "type": "log",       "userId": "12345", "fact": "Reiniciou o servidor nginx." }
 */
export class MemoryWriteTool extends BaseTool {
  public readonly name = 'memory_write';
  public readonly description =
    'Persiste um fato importante sobre o usuário. ' +
    'Use type="permanent" para fatos duradouros (preferências, contexto do projeto) ' +
    'e type="log" para registrar ações realizadas nesta sessão.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'ID do usuário (fornecido no system prompt como USER_ID).',
          },
          fact: {
            type: 'string',
            description: 'O fato a ser persistido. Seja conciso e específico.',
          },
          type: {
            type: 'string',
            enum: ['permanent', 'log'],
            description: '"permanent" para memória duradoura; "log" para log de atividades de hoje.',
          },
        },
        required: ['userId', 'fact', 'type'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    this.validate(args, ['userId', 'fact', 'type']);

    const { userId, fact, type } = args as { userId: string; fact: string; type: 'permanent' | 'log' };

    if (type !== 'permanent' && type !== 'log') {
      return this.error(`type inválido "${type}". Use "permanent" ou "log".`);
    }

    try {
      if (type === 'permanent') {
        PersistentMemory.curate(userId, fact);
        return this.success(`Fato permanente salvo: "${fact}"`);
      } else {
        PersistentMemory.appendLog(userId, fact);
        return this.success(`Atividade registrada no log de hoje: "${fact}"`);
      }
    } catch (err: any) {
      return this.error(`Falha ao salvar memória: ${err.message}`);
    }
  }
}
