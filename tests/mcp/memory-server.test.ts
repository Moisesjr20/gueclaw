/**
 * MCP Memory Server Tests
 * 
 * Tests for all 3 progressive disclosure tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MemoryManagerService } from '../../src/services/memory-extractor';
import { MemoryRepository } from '../../src/services/memory-extractor/memory-repository';
import { searchTool } from '../../src/mcp/tools/search-tool';
import { timelineTool } from '../../src/mcp/tools/timeline-tool';
import { getMemoriesTool } from '../../src/mcp/tools/get-memories-tool';
import { tokenTracker } from '../../src/mcp/utils/token-counter';

describe('MCP Memory Tools', () => {
  let memoryManager: MemoryManagerService;
  let repository: MemoryRepository;
  
  const TEST_USER_ID = 'test_user_123';
  const TEST_CONVERSATION_ID = 'test_conv_456';
  
  beforeAll(() => {
    memoryManager = MemoryManagerService.getInstance();
    repository = memoryManager.repository;
  });

  beforeEach(() => {
    // Clear test data before each test
    repository.deleteByUser(TEST_USER_ID);
    tokenTracker.reset();
  });

  afterAll(() => {
    // Cleanup
    repository.deleteByUser(TEST_USER_ID);
  });

  describe('searchTool (Layer 1)', () => {
    beforeEach(() => {
      // Seed test memories
      const testMemories = [
        {
          id: 'mem_test_1',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'Decidido usar OAuth 2.0 com PKCE para autenticação',
          importance: 'high' as const,
          confidence: 0.95,
          sourceMessageIds: ['msg_1'],
          tags: ['oauth', 'security', 'authentication'],
          extractedAt: Date.now() - 86400000, // 1 day ago
        },
        {
          id: 'mem_test_2',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'preference' as const,
          content: 'Prefere TypeScript ao invés de JavaScript',
          importance: 'medium' as const,
          confidence: 0.88,
          sourceMessageIds: ['msg_2'],
          tags: ['typescript', 'language'],
          extractedAt: Date.now() - 172800000, // 2 days ago
        },
        {
          id: 'mem_test_3',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'Implementar refresh token rotation automática',
          context: 'Para aumentar segurança conforme OAuth 2.1',
          importance: 'high' as const,
          confidence: 0.92,
          sourceMessageIds: ['msg_3'],
          tags: ['oauth', 'tokens', 'security'],
          extractedAt: Date.now() - 43200000, // 12 hours ago
        },
      ];

      testMemories.forEach((memory) => repository.add(memory));
    });

    it('should return search results matching query', async () => {
      const result = await searchTool({
        query: 'OAuth',
        userId: TEST_USER_ID,
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2); // 2 OAuth-related memories
      expect(response.totalResults).toBe(2);
      expect(response.tokensUsed).toBeGreaterThan(0);
    });

    it('should filter by memory type', async () => {
      const result = await searchTool({
        query: '',
        type: 'decision',
        userId: TEST_USER_ID,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2); // 2 decisions
      expect(response.results.every((r: any) => r.type === 'decision')).toBe(true);
    });

    it('should filter by importance', async () => {
      const result = await searchTool({
        query: '',
        importance: 'high',
        userId: TEST_USER_ID,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2); // 2 high importance
      expect(response.results.every((r: any) => r.importance === 'high')).toBe(true);
    });

    it('should limit results', async () => {
      const result = await searchTool({
        query: '',
        limit: 1,
        userId: TEST_USER_ID,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(1);
    });

    it('should filter by confidence threshold', async () => {
      const result = await searchTool({
        query: '',
        minConfidence: 0.9,
        userId: TEST_USER_ID,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.results.every((r: any) => r.confidence >= 0.9)).toBe(true);
    });

    it('should track token usage', async () => {
      await searchTool({
        query: 'OAuth',
        userId: TEST_USER_ID,
      });

      const stats = tokenTracker.getStats();
      expect(stats.searchCalls).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should return empty results for non-matching query', async () => {
      const result = await searchTool({
        query: 'nonexistent_keyword_xyz',
        userId: TEST_USER_ID,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(0);
      expect(response.totalResults).toBe(0);
    });
  });

  describe('timelineTool (Layer 2)', () => {
    let targetMemoryId: string;

    beforeEach(() => {
      // Seed chronological test memories
      const baseTime = Date.now() - 7200000; // 2 hours ago
      
      const testMemories = [
        {
          id: 'mem_timeline_1',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'context' as const,
          content: 'Discutindo arquitetura do sistema',
          importance: 'medium' as const,
          confidence: 0.85,
          sourceMessageIds: ['msg_t1'],
          tags: ['architecture'],
          extractedAt: baseTime,
        },
        {
          id: 'mem_timeline_2',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'preference' as const,
          content: 'Prefere soluções type-safe',
          importance: 'medium' as const,
          confidence: 0.82,
          sourceMessageIds: ['msg_t2'],
          tags: ['typescript'],
          extractedAt: baseTime + 60000, // +1 min
        },
        {
          id: 'mem_timeline_3',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'DECISÃO: Usar TypeScript para o projeto',
          context: 'Após análise de trade-offs',
          importance: 'high' as const,
          confidence: 0.95,
          sourceMessageIds: ['msg_t3'],
          tags: ['typescript', 'decision'],
          extractedAt: baseTime + 120000, // +2 min (TARGET)
        },
        {
          id: 'mem_timeline_4',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'constraint' as const,
          content: 'Prazo: 2 meses para MVP',
          importance: 'high' as const,
          confidence: 0.88,
          sourceMessageIds: ['msg_t4'],
          tags: ['deadline'],
          extractedAt: baseTime + 180000, // +3 min
        },
        {
          id: 'mem_timeline_5',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'goal' as const,
          content: 'Implementar features principais até maio',
          importance: 'medium' as const,
          confidence: 0.80,
          sourceMessageIds: ['msg_t5'],
          tags: ['goal', 'planning'],
          extractedAt: baseTime + 240000, // +4 min
        },
      ];

      testMemories.forEach((memory) => repository.add(memory));
      targetMemoryId = 'mem_timeline_3'; // The decision in the middle
    });

    it('should return timeline with before/after context', async () => {
      const result = await timelineTool({
        memoryId: targetMemoryId,
        before: 2,
        after: 2,
      });

      expect(result.isError).toBeFalsy();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.timeline).toHaveLength(5); // 2 before + target + 2 after
      
      const targetEntry = response.timeline.find((e: any) => e.isTarget);
      expect(targetEntry).toBeDefined();
      expect(targetEntry.id).toBe(targetMemoryId);
      expect(targetEntry.relativePosition).toBe(0);
    });

    it('should mark target memory correctly', async () => {
      const result = await timelineTool({
        memoryId: targetMemoryId,
      });

      const response = JSON.parse(result.content[0].text);
      const targetEntry = response.timeline.find((e: any) => e.isTarget);
      
      expect(targetEntry.isTarget).toBe(true);
      expect(targetEntry.content).toContain('DECISÃO: Usar TypeScript');
      expect(targetEntry.context).toBeDefined();
      expect(targetEntry.confidence).toBe(0.95);
    });

    it('should handle edge case (first memory)', async () => {
      const result = await timelineTool({
        memoryId: 'mem_timeline_1',
        before: 3,
        after: 3,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.windowSize.before).toBe(0); // No memories before
      expect(response.windowSize.after).toBeGreaterThan(0);
    });

    it('should handle edge case (last memory)', async () => {
      const result = await timelineTool({
        memoryId: 'mem_timeline_5',
        before: 3,
        after: 3,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.windowSize.before).toBeGreaterThan(0);
      expect(response.windowSize.after).toBe(0); // No memories after
    });

    it('should track token usage', async () => {
      await timelineTool({
        memoryId: targetMemoryId,
      });

      const stats = tokenTracker.getStats();
      expect(stats.timelineCalls).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should return error for non-existent memory', async () => {
      const result = await timelineTool({
        memoryId: 'mem_nonexistent',
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain('not found');
    });
  });

  describe('getMemoriesTool (Layer 3)', () => {
    beforeEach(() => {
      const testMemories = [
        {
          id: 'mem_get_1',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'Implementar OAuth 2.0 + PKCE',
          context: 'Análise de segurança mostrou necessidade',
          importance: 'critical' as const,
          confidence: 0.98,
          sourceMessageIds: ['msg_g1', 'msg_g2'],
          tags: ['oauth', 'security', 'pkce'],
          extractedAt: Date.now(),
          metadata: { references: ['RFC 7636'] },
        },
        {
          id: 'mem_get_2',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'skill' as const,
          content: 'Domina Node.js e TypeScript',
          importance: 'medium' as const,
          confidence: 0.85,
          sourceMessageIds: ['msg_g3'],
          tags: ['nodejs', 'typescript'],
          extractedAt: Date.now(),
        },
      ];

      testMemories.forEach((memory) => repository.add(memory));
    });

    it('should return full details for single ID', async () => {
      const result = await getMemoriesTool({
        ids: ['mem_get_1'],
      });

      expect(result.isError).toBeFalsy();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.memories).toHaveLength(1);
      expect(response.totalFetched).toBe(1);
      
      const memory = response.memories[0];
      expect(memory.id).toBe('mem_get_1');
      expect(memory.content).toBeDefined();
      expect(memory.context).toBeDefined();
      expect(memory.metadata).toBeDefined();
    });

    it('should batch multiple IDs efficiently', async () => {
      const result = await getMemoriesTool({
        ids: ['mem_get_1', 'mem_get_2'],
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.memories).toHaveLength(2);
      expect(response.totalFetched).toBe(2);
      expect(response.notFound).toHaveLength(0);
    });

    it('should report not found IDs', async () => {
      const result = await getMemoriesTool({
        ids: ['mem_get_1', 'mem_nonexistent', 'mem_get_2'],
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.memories).toHaveLength(2);
      expect(response.notFound).toContain('mem_nonexistent');
    });

    it('should include all memory fields', async () => {
      const result = await getMemoriesTool({
        ids: ['mem_get_1'],
      });

      const response = JSON.parse(result.content[0].text);
      const memory = response.memories[0];
      
      // Verify all fields are present
      expect(memory).toHaveProperty('id');
      expect(memory).toHaveProperty('conversationId');
      expect(memory).toHaveProperty('userId');
      expect(memory).toHaveProperty('type');
      expect(memory).toHaveProperty('content');
      expect(memory).toHaveProperty('context');
      expect(memory).toHaveProperty('importance');
      expect(memory).toHaveProperty('confidence');
      expect(memory).toHaveProperty('sourceMessageIds');
      expect(memory).toHaveProperty('tags');
      expect(memory).toHaveProperty('extractedAt');
      expect(memory).toHaveProperty('extractedAtISO');
      expect(memory).toHaveProperty('metadata');
    });

    it('should track token usage', async () => {
      await getMemoriesTool({
        ids: ['mem_get_1', 'mem_get_2'],
      });

      const stats = tokenTracker.getStats();
      expect(stats.getCalls).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should return error when no IDs provided', async () => {
      const result = await getMemoriesTool({
        ids: [],
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain('At least one memory ID is required');
    });
  });

  describe('Progressive Disclosure Workflow', () => {
    beforeEach(() => {
      // Seed realistic test data
      const testMemories = [
        {
          id: 'mem_workflow_1',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'Usar OAuth 2.0 para autenticação',
          context: 'Discussão sobre segurança',
          importance: 'high' as const,
          confidence: 0.95,
          sourceMessageIds: ['msg_w1'],
          tags: ['oauth', 'auth'],
          extractedAt: Date.now() - 3600000,
        },
        {
          id: 'mem_workflow_2',
          conversationId: TEST_CONVERSATION_ID,
          userId: TEST_USER_ID,
          type: 'decision' as const,
          content: 'Implementar TypeScript no backend',
          importance: 'high' as const,
          confidence: 0.90,
          sourceMessageIds: ['msg_w2'],
          tags: ['typescript', 'backend'],
          extractedAt: Date.now() - 1800000,
        },
      ];

      testMemories.forEach((memory) => repository.add(memory));
    });

    it('should follow 3-layer workflow efficiently', async () => {
      tokenTracker.reset();

      // Layer 1: Search (low tokens)
      const searchResult = await searchTool({
        query: 'OAuth',
        userId: TEST_USER_ID,
      });
      const searchResponse = JSON.parse(searchResult.content[0].text);
      const searchTokens = searchResponse.tokensUsed;

      // Layer 2: Timeline (medium tokens)
      const timelineResult = await timelineTool({
        memoryId: searchResponse.results[0].id,
      });
      const timelineResponse = JSON.parse(timelineResult.content[0].text);
      const timelineTokens = timelineResponse.tokensUsed;

      // Layer 3: Get full details (high tokens)
      const getResult = await getMemoriesTool({
        ids: [searchResponse.results[0].id],
      });
      const getResponse = JSON.parse(getResult.content[0].text);
      const getTokens = getResponse.tokensUsed;

      // Verify progressive token usage
      expect(searchTokens).toBeLessThan(timelineTokens);
      expect(timelineTokens).toBeLessThan(getTokens);

      // Verify total usage
      const stats = tokenTracker.getStats();
      expect(stats.searchCalls).toBe(1);
      expect(stats.timelineCalls).toBe(1);
      expect(stats.getCalls).toBe(1);
    });

    it('should demonstrate token savings vs loading all', async () => {
      // Progressive: search + get 1 memory
      tokenTracker.reset();
      
      const searchResult = await searchTool({
        query: '',
        userId: TEST_USER_ID,
      });
      const searchResponse = JSON.parse(searchResult.content[0].text);
      
      const getResult = await getMemoriesTool({
        ids: [searchResponse.results[0].id],
      });
      
      const progressiveTokens = tokenTracker.getStats().totalTokensUsed;

      // Traditional: get all memories
      tokenTracker.reset();
      
      const getAllResult = await getMemoriesTool({
        ids: searchResponse.results.map((r: any) => r.id),
      });
      
      const allTokens = tokenTracker.getStats().totalTokensUsed;

      // Progressive should use fewer tokens
      expect(progressiveTokens).toBeLessThan(allTokens);
    });
  });
});
