/**
 * MCP Protocol Types for GueClaw Memory Server
 */

import { MemoryType, MemoryImportance, ExtractedMemory } from '../services/memory-extractor/types';

/**
 * Search query arguments (Layer 1)
 */
export interface SearchArgs {
  query: string;
  type?: MemoryType;
  importance?: MemoryImportance;
  limit?: number;
  minConfidence?: number;
  userId?: string; // Optional: filter by user (default: all users)
}

/**
 * Compact memory index result (Layer 1 - ~50-100 tokens per result)
 */
export interface MemoryIndexResult {
  id: string;
  title: string; // Truncated content (max 80 chars)
  type: MemoryType;
  importance: MemoryImportance;
  confidence: number;
  date: string; // ISO 8601
  tags: string[]; // Limited to 5 for efficiency
}

/**
 * Search tool response (Layer 1)
 */
export interface SearchResponse {
  results: MemoryIndexResult[];
  totalResults: number;
  query: string;
  filters: {
    type?: MemoryType;
    importance?: MemoryImportance;
    minConfidence?: number;
    userId?: string;
  };
  tokensUsed: number;
  nextSteps: string[];
}

/**
 * Timeline query arguments (Layer 2)
 */
export interface TimelineArgs {
  memoryId: string;
  before?: number; // Number of memories before (default: 3)
  after?: number; // Number of memories after (default: 3)
}

/**
 * Timeline entry (compact format)
 */
export interface TimelineEntry {
  id: string;
  date: string; // ISO 8601
  type: MemoryType;
  content: string;
  importance: MemoryImportance;
  relativePosition: number; // Negative = before, 0 = target, positive = after
  isTarget?: boolean; // True for the target memory
  confidence?: number; // Only for target
  context?: string; // Only for target
  tags?: string[]; // Only for target
}

/**
 * Timeline tool response (Layer 2 - ~200-300 tokens)
 */
export interface TimelineResponse {
  timeline: TimelineEntry[];
  centerMemory: {
    id: string;
    content: string;
    context?: string;
    type: MemoryType;
    importance: MemoryImportance;
    confidence: number;
  };
  conversationId: string;
  windowSize: {
    before: number;
    after: number;
  };
  tokensUsed: number;
  nextSteps: string[];
}

/**
 * Get memories arguments (Layer 3)
 */
export interface GetMemoriesArgs {
  ids: string[];
}

/**
 * Full memory details (Layer 3 - ~500-1K tokens per memory)
 */
export interface FullMemoryDetails {
  id: string;
  conversationId: string;
  userId: string;
  type: MemoryType;
  content: string;
  context?: string;
  importance: MemoryImportance;
  confidence: number;
  sourceMessageIds: string[];
  tags: string[];
  extractedAt: number; // Unix timestamp
  extractedAtISO: string; // ISO 8601
  expiresAt?: number;
  metadata?: any;
}

/**
 * Get memories tool response (Layer 3)
 */
export interface GetMemoriesResponse {
  memories: FullMemoryDetails[];
  totalFetched: number;
  notFound: string[]; // IDs that were not found
  tokensUsed: number;
}

/**
 * MCP Tool Result wrapper
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Token usage statistics
 */
export interface TokenStats {
  searchCalls: number;
  timelineCalls: number;
  getCalls: number;
  totalTokensUsed: number;
  averageTokensPerSearch: number;
  averageTokensPerTimeline: number;
  averageTokensPerGet: number;
}
