import { MayanEDMSClient } from '../../src/clients/mayan-edms-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MayanEDMSClient', () => {
  const baseUrl = 'https://test.mayan.com/api';
  const token = 'test-token';
  let client: MayanEDMSClient;

  beforeEach(() => {
    client = new MayanEDMSClient(baseUrl, token);
    jest.clearAllMocks();
  });

  it('should be instantiated', () => {
    expect(client).toBeInstanceOf(MayanEDMSClient);
  });

  it('should upload document', async () => {
    const mockResponse = { data: { id: 123, uuid: 'abc' } };
    mockedAxios.post.mockResolvedValue(mockResponse);

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const result = await client.uploadDocument(file, ['tag'], { meta: 'value' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/documents/',
      expect.objectContaining({
        document_file: expect.any(File),
        tags: ['tag'],
        metadata: { meta: 'value' },
      }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(result.id).toBe(123);
  });

  it('should search documents', async () => {
    const mockResponse = { data: { results: [{ id: 1 }, { id: 2 }] } };
    mockedAxios.get.mockResolvedValue(mockResponse);

    const result = await client.searchDocuments('test', {});
    expect(mockedAxios.get).toHaveBeenCalledWith('/documents/', {
      params: { q: 'test' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(result.results.length).toBe(2);
  });
});
