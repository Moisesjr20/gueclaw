import { RagSearcher } from '../../../src/services/rag/rag-searcher';

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockQuery: jest.Mock;

jest.mock('../../../src/services/rag/rag-database', () => ({
  RagDatabase: {
    getInstance: jest.fn(() => ({
      getPool: jest.fn(() => ({ query: (...args: any[]) => mockQuery(...args) })),
      isConnected: jest.fn().mockReturnValue(true),
    })),
  },
}));

let mockEmbeddingsCreate: jest.Mock;

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: { create: (...args: any[]) => mockEmbeddingsCreate(...args) },
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeChunkRow(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    file_hash: 'abc123',
    file_path: '/data/docs/test.txt',
    chunk_index: 0,
    content: 'Este é um trecho relevante do documento.',
    metadata: {},
    indexed_at: new Date(),
    similarity: 0.87,
    doc_id: 10,
    original_filename: 'test.txt',
    stored_path: '/data/docs/2026-05/abc123_test.txt',
    file_size_bytes: 1024,
    tags: ['financeiro'],
    security_level: 'internal',
    pii_count: 0,
    doc_indexed_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeDocRow(overrides: Record<string, any> = {}) {
  return {
    id: 10,
    file_hash: 'abc123',
    original_filename: 'test.txt',
    stored_path: '/data/docs/2026-05/abc123_test.txt',
    file_size_bytes: 1024,
    tags: ['financeiro'],
    security_level: 'internal',
    pii_count: 0,
    indexed_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const FAKE_EMBEDDING = new Array(1536).fill(0.1);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RagSearcher', () => {
  let searcher: RagSearcher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn();
    mockEmbeddingsCreate = jest.fn().mockResolvedValue({
      data: [{ embedding: FAKE_EMBEDDING }],
    });
    searcher = new RagSearcher();
  });

  describe('search()', () => {
    it('returns RagSearchResult[] with correct shape', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeChunkRow()] });

      const results = await searcher.search('despesas de marketing');

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);

      const r = results[0];
      expect(r).toHaveProperty('chunk');
      expect(r).toHaveProperty('similarity');
      expect(r).toHaveProperty('document');
      expect(typeof r.similarity).toBe('number');
      expect(r.chunk.content).toBe('Este é um trecho relevante do documento.');
      expect(r.document.originalFilename).toBe('test.txt');
    });

    it('generates embedding before querying', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searcher.search('alguma consulta');

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'alguma consulta' })
      );
    });

    it('passes topK to the SQL query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searcher.search('query', 3);

      const call = mockQuery.mock.calls[0];
      expect(call[1]).toContain(3);
    });

    it('returns empty array when no chunks match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await searcher.search('nada relevante');
      expect(results).toHaveLength(0);
    });

    it('returns multiple results correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          makeChunkRow({ id: 1, similarity: 0.9, chunk_index: 0 }),
          makeChunkRow({ id: 2, similarity: 0.75, chunk_index: 1 }),
          makeChunkRow({ id: 3, similarity: 0.6, chunk_index: 2 }),
        ],
      });

      const results = await searcher.search('query');
      expect(results).toHaveLength(3);
      expect(results[0].similarity).toBe(0.9);
      expect(results[2].similarity).toBe(0.6);
    });

    it('maps tags and securityLevel from document row', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makeChunkRow({ tags: ['contrato', 'legal'], security_level: 'confidential' })],
      });

      const [result] = await searcher.search('cláusula');
      expect(result.document.tags).toEqual(['contrato', 'legal']);
      expect(result.document.securityLevel).toBe('confidential');
    });
  });

  describe('getDocument()', () => {
    it('returns RagDocument when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDocRow()] });

      const doc = await searcher.getDocument('abc123');

      expect(doc).not.toBeNull();
      expect(doc!.fileHash).toBe('abc123');
      expect(doc!.originalFilename).toBe('test.txt');
      expect(doc!.securityLevel).toBe('internal');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const doc = await searcher.getDocument('nonexistent');
      expect(doc).toBeNull();
    });

    it('passes fileHash to the query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searcher.getDocument('myhash');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('document_metadata'),
        ['myhash']
      );
    });
  });

  describe('listDocuments()', () => {
    it('returns all documents with no filters', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makeDocRow({ id: 1 }), makeDocRow({ id: 2, original_filename: 'other.pdf' })],
      });

      const docs = await searcher.listDocuments();
      expect(docs).toHaveLength(2);
    });

    it('returns empty array when no documents exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const docs = await searcher.listDocuments();
      expect(docs).toHaveLength(0);
    });

    it('maps all document fields correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDocRow()] });

      const [doc] = await searcher.listDocuments();
      expect(doc.fileHash).toBe('abc123');
      expect(doc.fileSizeBytes).toBe(1024);
      expect(Array.isArray(doc.tags)).toBe(true);
      expect(doc.piiCount).toBe(0);
    });
  });
});
