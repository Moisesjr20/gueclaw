/**
 * Skill Definition Types
 * 
 * Standardized interface for GueClaw skills
 * Based on Claude Code skill system architecture
 */

import { z } from 'zod';

/**
 * Skill metadata from frontmatter
 */
export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  category?: string;
  author?: string;
  blocked_tools?: string[];
  model_override?: string;
  telemetry_enabled?: boolean;
  reasoning_enabled?: boolean;
}

/**
 * Skill execution result
 */
export interface SkillResult {
  success: boolean;
  output: string;
  error?: string;
  duration?: number;
  tokens_used?: number;
  cost?: number;
}

/**
 * Skill execution options
 */
export interface SkillExecutionOptions {
  mode?: 'normal' | 'forked';
  useReasoning?: boolean;
  extraContext?: string;
  conversationId?: string;
  timeout?: number;
}

/**
 * Skill definition with content and metadata
 */
export interface SkillDefinition {
  name: string;
  metadata: SkillMetadata;
  content: string;
  filePath: string;
}

/**
 * Zod schema for skill tool input
 */
export const SkillToolInputSchema = z.object({
  skill_name: z.string().describe('Nome da skill a ser executada'),
  args: z.string().optional().describe('Argumentos ou contexto adicional para a skill'),
  mode: z.enum(['normal', 'forked']).optional().default('normal').describe('Modo de execução: normal (compartilha contexto) ou forked (isolado)'),
});

export type SkillToolInput = z.infer<typeof SkillToolInputSchema>;

/**
 * Progress callback for skill execution
 */
export interface SkillProgress {
  stage: 'loading' | 'executing' | 'completed' | 'error';
  message: string;
  percent?: number;
}

export type SkillProgressCallback = (progress: SkillProgress) => void;
