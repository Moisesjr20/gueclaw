import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RagIndexer } from '../../../src/services/rag/rag-indexer';

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

const FAKE_EMBEDDING = new Array(1536).fill(0.05);
let tmpDir: string;
let testFilePath: string;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RagIndexer', () => {
  let indexer: RagIndexer;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gueclaw-rag-test-'));
    testFilePath = path.join(tmpDir, 'sample.txt');
    fs.writeFileSync(
      testFilePath,
      'Este é um documento de teste.\n\nContém dois parágrafos para verificar o chunking.\n\nE um terceiro parágrafo com mais conteúdo relevante para indexação.'
    );
    process.env.RAG_DOCUMENTS_DIR = tmpDir;
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.RAG_DOCUMENTS_DIR;
    delete process.env.OPENROUTER_API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn().mockResolvedValue({ rows: [] });
    mockEmbeddingsCreate = jest.fn().mockResolvedValue({
      data: [{ embedding: FAKE_EMBEDDING }],
    });
    indexer = new RagIndexer();
  });

  describe('indexFile()', () => {
    it('returns success=true with chunksIndexed > 0 for a valid text file', async () => {
      const result = await indexer.indexFile(testFilePath);

      expect(result.success).toBe(true);
      expect(result.chunksIndexed).toBeGreaterThan(0);
      expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns success=false for a non-existent file', async () => {
      const result = await indexer.indexFile('/tmp/does-not-exist-xyz.txt');

      expect(result.success).toBe(false);
      expect(result.chunksIndexed).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('calls embedding API once per chunk', async () => {
      const result = await indexer.indexFile(testFilePath);

      expect(result.success).toBe(true);
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(result.chunksIndexed);
    });

    it('calls pool.query for metadata upsert and each chunk insert', async () => {
      const result = await indexer.indexFile(testFilePath);

      // At minimum: 1 metadata upsert + 1 DELETE + N chunk inserts
      const minCalls = 2 + result.chunksIndexed;
      expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(minCalls);
    });

    it('includes tags in indexing options', async () => {
      const result = await indexer.indexFile(testFilePath, {
        tags: ['financeiro', 'teste'],
      });

      expect(result.success).toBe(true);
      const metadataCall = mockQuery.mock.calls.find((call: any[]) =>
        call[0].includes('document_metadata') && call[0].includes('INSERT')
      );
      expect(metadataCall).toBeDefined();
      // params = [hash, filename, storedPath, size, tags, securityLevel, piiCount]
      const tagsParam = metadataCall[1].find((p: any) => Array.isArray(p));
      expect(tagsParam).toEqual(['financeiro', 'teste']);
    });

    it('skips security analysis when skipSecurity=true', async () => {
      const result = await indexer.indexFile(testFilePath, { skipSecurity: true });
      expect(result.success).toBe(true);
      expect(result.errors?.some((e: string) => e.includes('Security analysis skipped'))).toBeFalsy();
    });

    it('returns piiCount when security analysis runs', async () => {
      const result = await indexer.indexFile(testFilePath);

      expect(result.success).toBe(true);
      expect(typeof result.piiCount).toBe('number');
      expect(result.piiCount).toBeGreaterThanOrEqual(0);
    });

    it('returns a valid securityLevel classification', async () => {
      const result = await indexer.indexFile(testFilePath);

      const validLevels = ['public', 'internal', 'confidential', 'secret'];
      expect(validLevels).toContain(result.securityLevel);
    });

    it('returns success=false and errors when all embeddings fail', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('API rate limit'));

      const result = await indexer.indexFile(testFilePath);

      expect(result.chunksIndexed).toBe(0);
      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('Chunk 0 failed');
    });
  });

  describe('removeFile()', () => {
    it('calls pool.query with DELETE on document_metadata', async () => {
      await indexer.removeFile('abc123hash');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/DELETE FROM document_metadata/i);
      expect(params).toContain('abc123hash');
    });

    it('does not throw for non-existent hash', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      await expect(indexer.removeFile('nonexistent')).resolves.not.toThrow();
    });
  });
});
