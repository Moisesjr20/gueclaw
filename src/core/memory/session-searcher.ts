import { DatabaseConnection } from './database';
import type Database from 'better-sqlite3';

/**
 * Session Search Result
 */
export interface SessionSearchResult {
  conversationId: string;
  matchCount: number;
  relevanceScore: number;
  matches: SearchMatch[];
  summary?: string;
  firstMessage?: string;
  lastMessage?: string;
  messageCount?: number;
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * Individual search match within a message
 */
export interface SearchMatch {
  messageId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  snippet: string;
  timestamp: number;
  rank: number;
}

/**
 * Search Options
 */
export interface SearchOptions {
  maxResults?: number;
  userId?: string;
  conversationId?: string;
  roleFilter?: ('user' | 'assistant' | 'system' | 'tool')[];
  dateFrom?: number;
  dateTo?: number;
  includeContext?: boolean;
  contextWindow?: number; // Number of messages before/after match
  summarize?: boolean;
}

/**
 * FTS5 Raw Result
 */
interface FTS5Result {
  rowid: number;
  content: string;
  conversation_id: string;
  role: string;
  timestamp: number;
  rank: number;
}

/**
 * Session Searcher - FTS5-based conversation search
 * 
 * Uses SQLite FTS5 for fast full-text search across all messages.
 * Groups results by conversation and provides relevance scoring.
 */
export class SessionSearcher {
  private db: Database.Database;
  
  // Performance optimization: Limit search depth to last 6 months by default
  private static readonly DEFAULT_MAX_AGE_DAYS = 180;
  
  // Cache for recent queries (simple LRU-like cache)
  private static queryCache = new Map<string, { result: SessionSearchResult[]; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 50;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Search conversations by query string
   * 
   * @param query - Search query (supports FTS5 syntax: phrases "like this", AND, OR, NOT)
   * @param options - Search options
   * @returns Array of session search results
   */
  async searchSessions(
    query: string,
    options: SearchOptions = {}
  ): Promise<SessionSearchResult[]> {
    const {
      maxResults = 10,
      userId,
      conversationId,
      roleFilter,
      dateFrom,
      dateTo,
      includeContext = false,
      contextWindow = 3,
    } = options;

    // Generate cache key
    const cacheKey = JSON.stringify({ query, ...options });
    
    // Check cache
    const cached = SessionSearcher.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < SessionSearcher.CACHE_TTL_MS) {
      console.log('🎯 Cache hit for search query');
      return cached.result;
    }

    // Apply default 6-month limit if no date filter provided
    const effectiveDateFrom = dateFrom || 
      (Math.floor(Date.now() / 1000) - (SessionSearcher.DEFAULT_MAX_AGE_DAYS * 24 * 60 * 60));

    // Prepare FTS5 query
    const ftsQuery = this.prepareFTSQuery(query);

    // Execute FTS5 search
    const matches = this.searchFTS5(ftsQuery, {
      userId,
      conversationId,
      roleFilter,
      dateFrom: effectiveDateFrom,
      dateTo,
      maxResults: maxResults * 5, // Get more raw results to group by session
    });

    // Group matches by conversation
    const sessionGroups = this.groupBySession(matches);

    // Convert to SessionSearchResult and sort by relevance
    const results: SessionSearchResult[] = [];

    for (const [convId, sessionMatches] of sessionGroups.entries()) {
      const relevanceScore = this.calculateRelevance(sessionMatches);
      
      // Load session metadata
      const metadata = this.loadSessionMetadata(convId);

      const result: SessionSearchResult = {
        conversationId: convId,
        matchCount: sessionMatches.length,
        relevanceScore,
        matches: sessionMatches.map(m => ({
          messageId: `${m.rowid}`,
          role: m.role as any,
          content: m.content,
          snippet: this.extractSnippet(m.content, query, 200),
          timestamp: m.timestamp,
          rank: m.rank,
        })),
        ...metadata,
      };

      // Load context window if requested
      if (includeContext) {
        result.matches = result.matches.map(match => ({
          ...match,
          content: this.loadContextWindow(match.messageId, contextWindow),
        }));
      }

      results.push(result);
    }

    // Sort by relevance and limit
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalResults = results.slice(0, maxResults);
    
    // Cache results
    SessionSearcher.queryCache.set(cacheKey, {
      result: finalResults,
      timestamp: Date.now(),
    });
    
    // Maintain cache size
    if (SessionSearcher.queryCache.size > SessionSearcher.MAX_CACHE_SIZE) {
      const firstKey = SessionSearcher.queryCache.keys().next().value;
      if (firstKey) {
        SessionSearcher.queryCache.delete(firstKey);
      }
    }
    
    return finalResults;
  }

  /**
   * Prepare FTS5 query string
   * Escapes special characters and handles phrases
   * 
   * @param query - Raw query string
   * @returns FTS5-formatted query
   */
  private prepareFTSQuery(query: string): string {
    // Handle quoted phrases (already valid in FTS5)
    if (query.includes('"')) {
      return query;
    }

    // Escape FTS5 special characters
    let escaped = query.replace(/[(){}[\]^"~*:|]/g, ' ');

    // Split into words and join with implicit AND
    const words = escaped.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      throw new Error('Search query is empty');
    }

    // Return as phrase for better relevance
    return `"${words.join(' ')}"`;
  }

  /**
   * Execute FTS5 search query
   * 
   * @param ftsQuery - FTS5 formatted query
   * @param filters - Additional filters
   * @returns Raw FTS5 results
   */
  private searchFTS5(
    ftsQuery: string,
    filters: {
      userId?: string;
      conversationId?: string;
      roleFilter?: string[];
      dateFrom?: number;
      dateTo?: number;
      maxResults?: number;
    }
  ): FTS5Result[] {
    const { userId, conversationId, roleFilter, dateFrom, dateTo, maxResults = 50 } = filters;

    // Build SQL query
    let sql = `
      SELECT 
        m.rowid,
        m.content,
        m.conversation_id,
        m.role,
        m.timestamp,
        fts.rank
      FROM messages_fts fts
      INNER JOIN messages m ON fts.rowid = m.rowid
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE messages_fts MATCH ?
    `;

    const params: any[] = [ftsQuery];

    // Apply filters
    if (userId) {
      sql += ' AND c.user_id = ?';
      params.push(userId);
    }

    if (conversationId) {
      sql += ' AND m.conversation_id = ?';
      params.push(conversationId);
    }

    if (roleFilter && roleFilter.length > 0) {
      sql += ` AND m.role IN (${roleFilter.map(() => '?').join(',')})`;
      params.push(...roleFilter);
    }

    if (dateFrom) {
      sql += ' AND m.timestamp >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ' AND m.timestamp <= ?';
      params.push(dateTo);
    }

    // Order by relevance (FTS5 rank) and limit
    sql += ' ORDER BY fts.rank LIMIT ?';
    params.push(maxResults);

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as FTS5Result[];
    } catch (error: any) {
      console.error('❌ FTS5 search failed:', error.message);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Group FTS5 results by conversation
   * 
   * @param matches - Raw FTS5 results
   * @returns Map of conversation ID to matches
   */
  private groupBySession(matches: FTS5Result[]): Map<string, FTS5Result[]> {
    const groups = new Map<string, FTS5Result[]>();

    for (const match of matches) {
      const existing = groups.get(match.conversation_id) || [];
      existing.push(match);
      groups.set(match.conversation_id, existing);
    }

    return groups;
  }

  /**
   * Calculate relevance score for a session
   * 
   * @param matches - Matches in the session
   * @returns Relevance score (0-1)
   */
  private calculateRelevance(matches: FTS5Result[]): number {
    if (matches.length === 0) return 0;

    // Average FTS5 rank (negative values, closer to 0 is better)
    const avgRank = matches.reduce((sum, m) => sum + m.rank, 0) / matches.length;

    // Normalize to 0-1 range (FTS5 rank is typically -1 to -30+)
    // Better matches have rank closer to 0
    const normalized = Math.max(0, 1 + avgRank / 30);

    // Boost score for multiple matches
    const matchBoost = Math.min(1, matches.length / 5);

    return (normalized * 0.7 + matchBoost * 0.3);
  }

  /**
   * Load session metadata
   * 
   * @param conversationId - Conversation ID
   * @returns Session metadata
   */
  private loadSessionMetadata(conversationId: string): {
    firstMessage?: string;
    lastMessage?: string;
    messageCount?: number;
    timeRange?: { start: number; end: number };
  } {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as count,
          MIN(timestamp) as start,
          MAX(timestamp) as end,
          (SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY timestamp LIMIT 1) as first,
          (SELECT content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1) as last
        FROM messages
        WHERE conversation_id = ?
      `);

      const row = stmt.get(conversationId, conversationId, conversationId) as any;

      return {
        firstMessage: row.first,
        lastMessage: row.last,
        messageCount: row.count,
        timeRange: {
          start: row.start,
          end: row.end,
        },
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract snippet around query match
   * 
   * @param content - Full message content
   * @param query - Search query
   * @param maxLength - Maximum snippet length
   * @returns Snippet with ... ellipsis
   */
  private extractSnippet(content: string, query: string, maxLength: number): string {
    // Remove quotes from query for matching
    const searchTerm = query.replace(/['"]/g, '').toLowerCase();
    const contentLower = content.toLowerCase();

    // Find first occurrence
    const index = contentLower.indexOf(searchTerm);

    if (index === -1) {
      // Fallback: return beginning
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Calculate snippet window
    const halfWindow = Math.floor(maxLength / 2);
    let start = Math.max(0, index - halfWindow);
    let end = Math.min(content.length, index + searchTerm.length + halfWindow);

    // Adjust to avoid cutting words
    if (start > 0) {
      const spaceIndex = content.lastIndexOf(' ', start);
      if (spaceIndex > 0 && spaceIndex > start - 20) {
        start = spaceIndex + 1;
      }
    }

    if (end < content.length) {
      const spaceIndex = content.indexOf(' ', end);
      if (spaceIndex > 0 && spaceIndex < end + 20) {
        end = spaceIndex;
      }
    }

    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Load context window around a match
   * 
   * @param messageId - Message rowid
   * @param window - Number of messages before/after
   * @returns Formatted context
   */
  private loadContextWindow(messageId: string, window: number): string {
    try {
      const rowid = parseInt(messageId);
      
      const stmt = this.db.prepare(`
        SELECT role, content, timestamp
        FROM messages
        WHERE conversation_id = (
          SELECT conversation_id FROM messages WHERE rowid = ?
        )
        AND rowid BETWEEN ? AND ?
        ORDER BY timestamp
      `);

      const rows = stmt.all(rowid, rowid - window, rowid + window) as any[];

      return rows.map(r => `[${r.role}]: ${r.content}`).join('\n\n');
    } catch (error) {
      return `[Message ${messageId}]`;
    }
  }

  /**
   * Format conversation for LLM context
   * 
   * @param conversationId - Conversation ID
   * @returns Formatted conversation
   */
  async formatConversation(conversationId: string): Promise<string> {
    try {
      const stmt = this.db.prepare(`
        SELECT role, content, timestamp
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp
      `);

      const messages = stmt.all(conversationId) as any[];

      const formatted = messages.map(m => {
        const date = new Date(m.timestamp * 1000).toISOString();
        return `[${date}] ${m.role}: ${m.content}`;
      }).join('\n\n');

      return formatted;
    } catch (error: any) {
      throw new Error(`Failed to format conversation: ${error.message}`);
    }
  }
}
