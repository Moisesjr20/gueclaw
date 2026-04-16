/**
 * Command System Type Definitions (DVACE Architecture)
 * 
 * Implements structured command patterns inspired by Claude Code's dvace architecture.
 * Commands are partitioned into three types:
 * - LocalCommand: Execute immediately without LLM invocation
 * - PromptCommand: Instruct LLM with restricted tool permissions
 * - ToolCommand: Direct wrapper for executable tools
 * 
 * @see CHECKLIST-DVACE-REFACTOR.md - Phase 1.1
 */

import { Message, ToolCall, ToolResult } from './index';
import type { MemoryManager } from '../core/memory/memory-manager';

/**
 * Context provided to command execution handlers
 */
export interface CommandContext {
  userId: string;
  conversationId: string;
  messageHistory: Message[];
  metadata?: Record<string, any>;
  memoryManager?: MemoryManager;
  ctx?: any; // Telegram context for re-execution
}

/**
 * Generic result from any command execution
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * LocalCommand - Executes immediately without LLM invocation
 * 
 * Use for:
 * - /start, /help, /version (static responses)
 * - /status, /tasks (query local state)
 * - /clear (clear conversation history)
 * 
 * Characteristics:
 * - No LLM API call
 * - Response < 500ms
 * - Deterministic output
 */
export interface LocalCommand {
  type: 'local';
  name: string;
  description: string;
  aliases?: string[];
  
  /**
   * Synchronous or async execution handler
   * @param args - Command arguments (e.g., "/task 123" → args = ["123"])
   * @param context - Execution context
   * @returns Command result
   */
  run(args: string[], context: CommandContext): Promise<CommandResult> | CommandResult;
  
  /**
   * Optional usage help text
   */
  usage?: string;
}

/**
 * PromptCommand - Instructs LLM with restricted tool permissions
 * 
 * Use for:
 * - /review (FileRead, FileEdit, Bash(git *))
 * - /commit (Bash(git commit), Bash(git push))
 * - /deploy (SSHExec, DockerCommand)
 * 
 * Characteristics:
 * - Invokes agent loop with LLM
 * - Tool permissions enforced via allowedTools
 * - Supports wildcard patterns (e.g., "Bash(git *)")
 */
export interface PromptCommand {
  type: 'prompt';
  name: string;
  description: string;
  aliases?: string[];
  
  /**
   * Tools allowed during command execution
   * Supports patterns:
   * - Wildcard: "FileRead(*)" allows all file reads
   * - Prefix: "Bash(git *)" allows git commands only
   * - Negation: "!FileEdit(*.env)" blocks .env file edits
   * - All: "*" allows all tools (default for free conversation)
   */
  allowedTools: string[];
  
  /**
   * Generate the prompt to send to the LLM
   * @param args - Command arguments
   * @param context - Execution context
   * @returns Prompt string or Message array
   */
  getPrompt(args: string[], context: CommandContext): Promise<string | Message[]> | string | Message[];
  
  /**
   * Optional pre-execution hook (e.g., validate git repo exists)
   */
  beforeExecution?(args: string[], context: CommandContext): Promise<void> | void;
  
  /**
   * Optional post-execution hook (e.g., send summary message)
   */
  afterExecution?(result: CommandResult, context: CommandContext): Promise<void> | void;
  
  /**
   * Optional usage help text
   */
  usage?: string;
  
  /**
   * Maximum iterations for agent loop (default: from config)
   */
  maxIterations?: number;
}

/**
 * ToolCommand - Direct wrapper for executable tools
 * 
 * Use for:
 * - Internal tool invocations (programmatic use)
 * - Chaining multiple tools in a workflow
 * - Testing tool execution outside agent loop
 * 
 * Characteristics:
 * - No LLM involved
 * - Direct tool execution
 * - Returns ToolResult
 */
export interface ToolCommand {
  type: 'tool';
  name: string;
  description: string;
  
  /**
   * The underlying tool name to execute
   */
  toolName: string;
  
  /**
   * Execute the tool with given input
   * @param input - Tool input parameters
   * @param context - Execution context
   * @returns Tool execution result
   */
  execute(input: Record<string, any>, context: CommandContext): Promise<ToolResult>;
  
  /**
   * Validate tool input before execution
   */
  validateInput?(input: Record<string, any>): boolean | string;
}

/**
 * Union type for all command types
 */
export type Command = LocalCommand | PromptCommand | ToolCommand;

/**
 * Type guard: Check if command is LocalCommand
 */
export function isLocalCommand(command: Command): command is LocalCommand {
  return command.type === 'local';
}

/**
 * Type guard: Check if command is PromptCommand
 */
export function isPromptCommand(command: Command): command is PromptCommand {
  return command.type === 'prompt';
}

/**
 * Type guard: Check if command is ToolCommand
 */
export function isToolCommand(command: Command): command is ToolCommand {
  return command.type === 'tool';
}

/**
 * Command registration options
 */
export interface CommandRegistrationOptions {
  /**
   * Override existing command with same name
   */
  override?: boolean;
  
  /**
   * Command is hidden from /help listing
   */
  hidden?: boolean;
  
  /**
   * Required user role (e.g., 'admin', 'user')
   */
  requiredRole?: string;
}
