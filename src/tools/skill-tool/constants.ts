/**
 * SkillTool Constants
 * 
 * Inspired by Claude Code SkillTool architecture
 * Clean-room implementation for GueClaw 3.0
 */

export const SKILL_TOOL_NAME = 'use_skill';

export const SKILL_TOOL_DESCRIPTION = `Execute uma skill especializada do GueClaw.

Skills disponíveis incluem:
- doe: Engenheiro de Software Sênior (Clean Arch + DDD)
- vps-manager: Gerenciamento de VPS e infraestrutura
- n8n-expert: Automação de workflows
- gohighlevel-api: Integração com GoHighLevel CRM
- social-media: Estratégia de conteúdo e copywriting
- seo-expert: Otimização para mecanismos de busca
- project-docs: Documentação técnica especializada
- E muitas outras...

Use esta tool quando a tarefa se encaixar melhor em uma skill específica.`;

export const SKILL_EXECUTION_MODE = {
  NORMAL: 'normal',
  FORKED: 'forked',
} as const;

export type SkillExecutionMode = typeof SKILL_EXECUTION_MODE[keyof typeof SKILL_EXECUTION_MODE];
