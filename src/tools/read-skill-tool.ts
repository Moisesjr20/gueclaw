import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { SkillLoader } from '../core/skills/skill-loader';

/**
 * ReadSkillTool — lets the LLM load the full instructions of a skill on demand.
 *
 * The system prompt contains only a lightweight manifest (name + description).
 * When the LLM needs the full skill content it calls this tool with the skill's
 * directory name (provided in the manifest as `dirName`).
 */
export class ReadSkillTool extends BaseTool {
  public readonly name = 'read_skill';
  public readonly description =
    'Lê as instruções completas de uma skill disponível. ' +
    'Use quando precisar executar uma tarefa específica e quiser seguir os procedimentos da skill correspondente. ' +
    'O argumento skillName é o nome do diretório da skill (listado no manifesto do system prompt).';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          skillName: {
            type: 'string',
            description: 'Nome do diretório da skill (ex: "vps-manager", "uazapi-whatsapp").',
          },
        },
        required: ['skillName'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    this.validate(args, ['skillName']);

    const { skillName } = args as { skillName: string };

    // Prevent path traversal
    if (skillName.includes('..') || skillName.includes('/') || skillName.includes('\\')) {
      return this.error('skillName inválido — não pode conter separadores de caminho.');
    }

    if (!SkillLoader.skillExists(skillName)) {
      return this.error(`Skill "${skillName}" não encontrada. Verifique o manifesto no system prompt.`);
    }

    const content = SkillLoader.loadSkillContent(skillName);

    if (!content) {
      return this.error(`Falha ao ler conteúdo da skill "${skillName}".`);
    }

    return this.success(content, { skillName });
  }
}
