/**
 * Tool factory exports
 * Provides simplified tool creation with buildTool() pattern
 */

export { buildTool, z } from './build-tool';
export type { ToolConfig, ToolExample, ToolHelpers } from './types';
export { convertZodSchemaToToolDefinition } from './schema-converter';
