/**
 * Core Type Definitions for GueClaw Agent
 */

export interface Message {
  id?: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  
  // Function calling support
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  provider: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  category?: string;
  tools?: string[];
  blocked_tools?: string[];
}

export interface AgentConfig {
  maxIterations: number;
  memoryWindowSize: number;
  defaultProvider: string;
  temperature?: number;
  enableLogging?: boolean;
}

export interface VPSConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  sshKeyPath?: string;
  sudoPassword?: string;
}

export interface FileAttachment {
  type: 'image' | 'audio' | 'document' | 'video';
  fileId: string;
  filePath?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
}

export interface TelegramInput {
  userId: string;
  messageId: number;
  chatId: number;
  text?: string;
  attachments?: FileAttachment[];
  metadata?: Record<string, any>;
}

export interface AgentAction {
  thought: string;
  action?: string;
  actionInput?: Record<string, any>;
  observation?: string;
}

/**
 * Sentinel returned by the LLM when it already replied via a tool call.
 * The output layer MUST NOT forward this string to Telegram.
 */
export const NO_REPLY = 'NO_REPLY';
