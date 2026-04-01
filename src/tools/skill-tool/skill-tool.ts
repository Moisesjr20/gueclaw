/**
 * SkillTool - LLM-Invocable Skill Executor
 * 
 * Allows the LLM to proactively invoke GueClaw skills as a tool.
 * Inspired by Claude Code SkillTool architecture.
 * 
 * Usage by LLM:
 * {
 *   "name": "use_skill",
 *   "input": {
 *     "skill_name": "doe",
 *     "args": "implementar feature X",
 *     "mode": "normal"
 *   }
 * }
 */

import { BaseTool } from '../base-tool';
import { SkillExecutor } from '../../core/skills/skill-executor';
import { SkillRegistry } from './skill-registry';
import { 
  SKILL_TOOL_NAME, 
  SKILL_TOOL_DESCRIPTION
} from './constants';
import type { 
  SkillToolInput, 
  SkillProgressCallback 
} from './skill-definition';
import { ToolResult } from '../../types';

export class SkillTool extends BaseTool {
  public readonly name = SKILL_TOOL_NAME;
  public readonly description = SKILL_TOOL_DESCRIPTION;

  constructor() {
    super(); // Call parent constructor
    // Initialize registry on tool creation
    SkillRegistry.initialize();
  }

  /**
   * Execute the skill tool
   */
  async execute(args: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const { skill_name, args: skillArgs, mode = 'normal' } = args as SkillToolInput;

    try {
      // Validate skill exists
      if (!SkillRegistry.has(skill_name)) {
        const availableSkills = SkillRegistry.getAllNames();
        return this.error(
          `Skill "${skill_name}" não encontrada.\n\n` +
          `Skills disponíveis:\n${availableSkills.map(s => `  - ${s}`).join('\n')}\n\n` +
          `Use uma das skills listadas acima.`
        );
      }

      // Get skill metadata
      const skillMetadata = SkillRegistry.getMetadata(skill_name);
      const useReasoning = skillMetadata?.reasoning_enabled ?? false;

      console.log(`🎯 SkillTool: Executing "${skill_name}" in ${mode} mode`);

      // Execute skill using SkillExecutor
      // TODO: Implement forked mode when ForkedExecutor is ready
      // TODO: Pass conversationHistory and conversationId when available in context
      const result = await SkillExecutor.execute(
        skill_name,
        skillArgs || '',
        [], // conversationHistory - will be integrated later
        useReasoning,
        undefined, // extraContext
        undefined // conversationId
      );

      const duration = Date.now() - startTime;

      // Log telemetry (if enabled)
      if (skillMetadata?.telemetry_enabled) {
        this.logSkillExecution(skill_name, true, duration);
      }

      return this.success(
        `✅ Skill "${skill_name}" executada com sucesso (${duration}ms, modo: ${mode})\n` +
        `${'─'.repeat(60)}\n\n${result}`,
        { skill_name, duration, mode }
      );

    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`❌ SkillTool error:`, error);

      // Log telemetry
      const skillMetadata = SkillRegistry.getMetadata(skill_name);
      if (skillMetadata?.telemetry_enabled) {
        this.logSkillExecution(skill_name, false, duration, error.message);
      }

      return this.error(
        `Erro ao executar skill "${skill_name}": ${error.message}`,
        { skill_name, duration, error: error.message }
      );
    }
  }

  /**
   * Log skill execution for telemetry
   */
  private logSkillExecution(
    skillName: string,
    success: boolean,
    duration: number,
    error?: string
  ): void {
    // TODO: Integrate with cost tracker / telemetry service when implemented
    console.log(`📊 Skill telemetry: ${skillName} | success: ${success} | duration: ${duration}ms`);
    if (error) {
      console.error(`   Error: ${error}`);
    }
  }

  /**
   * Get tool definition for LLM
   */
  getDefinition() {
    // Add list of available skills to description
    const availableSkills = SkillRegistry.getAllNames().slice(0, 20); // Limit to avoid token bloat
    const skillsList = availableSkills.map(name => {
      const metadata = SkillRegistry.getMetadata(name);
      return `  - ${name}: ${metadata?.description || 'No description'}`;
    }).join('\n');

    const enhancedDescription = `${this.description}\n\nSkills disponíveis:\n${skillsList}${
      SkillRegistry.getAllNames().length > 20 ? '\n  ... e mais' : ''
    }`;

    return {
      name: this.name,
      description: enhancedDescription,
      parameters: {
        type: 'object' as const,
        properties: {
          skill_name: {
            type: 'string',
            description: 'Nome da skill a ser executada',
          },
          args: {
            type: 'string',
            description: 'Argumentos ou contexto adicional para a skill',
          },
          mode: {
            type: 'string',
            enum: ['normal', 'forked'],
            description: 'Modo de execução: normal (compartilha contexto) ou forked (isolado)',
          },
        },
        required: ['skill_name'],
      },
    };
  }
}

/**
 * Factory function to create SkillTool instance
 */
export function createSkillTool(): SkillTool {
  return new SkillTool();
}
