import { RagSearcher } from '../../src/services/rag/rag-searcher';
import { RagDatabase } from '../../src/services/rag/rag-database';
import OpenAI from 'openai';

jest.mock('../../src/services/rag/rag-database');
jest.mock('openai');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('RagSearcher', () => {
  let searcher: RagSearcher;
  let mockQuery: jest.Mock;
  let mockEmbeddingsCreate: jest.Mock;

  const FAKE_EMBEDDING = Array(1536).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    const mockDb = { getPool: jest.fn().mockReturnValue({ query: mockQuery }) };
    (RagDatabase.getInstance as jest.Mock).mockReturnValue(mockDb);

    mockEmbeddingsCreate = jest.fn().mockResolvedValue({
      data: [{ embedding: FAKE_EMBEDDING }],
    });
    MockedOpenAI.mockImplementation(() => ({
      embeddings: { create: mockEmbeddingsCreate },
    }) as any);

    searcher = new RagSearcher();
  });

  const makeSearchRow = (overrides: Record<string, any> = {}) => ({
    id: 1,
    file_hash: 'abc123',
    file_path: '/data/docs/file.pdf',
    chunk_index: 0,
    content: 'conteúdo de exemplo do chunk',
    metadata: { page: 1 },
    indexed_at: new Date('2024-01-01'),
    similarity: '0.92',
    doc_id: 10,
    original_filename: 'file.pdf',
    stored_path: '/data/docs/file.pdf',
    file_size_bytes: 1024,
    tags: ['financeiro'],
    security_level: 'internal',
    pii_count: 0,
    doc_indexed_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-02'),
    ...overrides,
  });

  const makeDocRow = (overrides: Record<string, any> = {}) => ({
    id: 10,
    file_hash: 'abc123',
    original_filename: 'file.pdf',
    stored_path: '/data/docs/file.pdf',
    file_size_bytes: 2048,
    tags: ['rh'],
    security_level: 'confidential',
    pii_count: 3,
    indexed_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-15'),
    ...overrides,
  });

  describe('search()', () => {
    it('retorna resultados mapeados corretamente', async () => {
      const row = makeSearchRow();
      mockQuery.mockResolvedValue({ rows: [row] });

      const results = await searcher.search('consulta de teste');

      expect(results).toHaveLength(1);
      const [res] = results;
      expect(res.chunk.content).toBe('conteúdo de exemplo do chunk');
      expect(res.chunk.fileHash).toBe('abc123');
      expect(res.chunk.chunkIndex).toBe(0);
      expect(res.similarity).toBe(0.92);
      expect(res.document.originalFilename).toBe('file.pdf');
      expect(res.document.id).toBe(10);
    });

    it('usa topK padrão (5) quando não especificado', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.search('consulta');

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(5);
    });

    it('respeita topK fornecido na chamada', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.search('consulta', 12);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(12);
    });

    it('gera embedding para a query', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.search('encontra o documento');

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'encontra o documento' })
      );
    });

    it('passa o vetor como literal no parâmetro SQL', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.search('query');

      const [, params] = mockQuery.mock.calls[0];
      expect(typeof params[0]).toBe('string');
      expect(params[0]).toMatch(/^\[[\d.,\s]+\]$/);
    });

    it('retorna array vazio quando não há resultados', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await searcher.search('sem resultados');
      expect(results).toHaveLength(0);
    });

    it('retorna múltiplos resultados', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          makeSearchRow({ chunk_index: 0, similarity: '0.95' }),
          makeSearchRow({ chunk_index: 1, similarity: '0.80', id: 2 }),
        ],
      });

      const results = await searcher.search('multi');
      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.95);
      expect(results[1].similarity).toBe(0.80);
    });

    it('limita a query de embedding a 8000 caracteres', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const longQuery = 'a'.repeat(10000);
      await searcher.search(longQuery);

      const call = mockEmbeddingsCreate.mock.calls[0][0];
      expect(call.input.length).toBe(8000);
    });

    it('chunk.metadata é {} quando row.metadata é null', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeSearchRow({ metadata: null })],
      });

      const results = await searcher.search('q');
      expect(results[0].chunk.metadata).toEqual({});
    });

    it('document.tags é [] quando row.tags é null', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeSearchRow({ tags: null })],
      });

      const results = await searcher.search('q');
      expect(results[0].document.tags).toEqual([]);
    });
  });

  describe('getDocument()', () => {
    it('retorna documento quando encontrado', async () => {
      const row = makeDocRow();
      mockQuery.mockResolvedValue({ rows: [row] });

      const doc = await searcher.getDocument('abc123');

      expect(doc).not.toBeNull();
      expect(doc!.fileHash).toBe('abc123');
      expect(doc!.originalFilename).toBe('file.pdf');
      expect(doc!.securityLevel).toBe('confidential');
      expect(doc!.piiCount).toBe(3);
      expect(doc!.fileSizeBytes).toBe(2048);
    });

    it('retorna null quando não encontrado', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const doc = await searcher.getDocument('hash-inexistente');
      expect(doc).toBeNull();
    });

    it('usa file_hash como parâmetro da query', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.getDocument('meu-hash');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['meu-hash']
      );
    });
  });

  describe('listDocuments()', () => {
    it('lista todos os documentos sem filtros', async () => {
      const row = makeDocRow();
      mockQuery.mockResolvedValue({ rows: [row] });

      const docs = await searcher.listDocuments();

      expect(docs).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM document_metadata'),
        []
      );
    });

    it('aplica filtro de tags', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments({ tags: ['financeiro'] });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('tags &&');
      expect(params).toContainEqual(['financeiro']);
    });

    it('aplica filtro de securityLevel', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments({ securityLevel: 'confidential' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('security_level');
      expect(params).toContain('confidential');
    });

    it('aplica filtro de filename com ILIKE', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments({ filename: 'relatorio' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ILIKE');
      expect(params).toContain('%relatorio%');
    });

    it('aplica múltiplos filtros combinados', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments({
        tags: ['rh'],
        securityLevel: 'internal',
        filename: 'q1',
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('tags &&');
      expect(sql).toContain('security_level');
      expect(sql).toContain('ILIKE');
      expect(params).toContain('internal');
      expect(params).toContain('%q1%');
    });

    it('ordena por indexed_at DESC', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY indexed_at DESC');
    });

    it('retorna array vazio quando não há documentos', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const docs = await searcher.listDocuments();
      expect(docs).toHaveLength(0);
    });

    it('ignora filtros vazios (tags array vazio)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searcher.listDocuments({ tags: [] });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('tags &&');
      expect(params).toHaveLength(0);
    });
  });
});
