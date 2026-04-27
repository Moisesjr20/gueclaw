import { OpenRouterProvider } from '../../src/core/providers/openrouter-provider';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouterProvider', () => {
  const apiKey = 'test-api-key';
  const model = 'test/model';
  const baseUrl = 'https://test.openrouter.ai/api/v1';
  let provider: OpenRouterProvider;

  beforeEach(() => {
    provider = new OpenRouterProvider(apiKey, baseUrl, model);
    jest.clearAllMocks();
  });

  it('should be instantiated', () => {
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider.getModel()).toBe(model);
  });

  it('should generate completion', async () => {
    const mockResponse = {
      data: {
        choices: [{ message: { content: 'Hello world' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      },
    };
    mockedAxios.post.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hi' }];
    const result = await provider.generateCompletion(messages);

    expect(mockedAxios.post).toHaveBeenCalledWith('/chat/completions', {
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    });
    expect(result.content).toBe('Hello world');
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
  });

  it('should handle errors', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    const messages = [{ role: 'user', content: 'Hi' }];
    await expect(provider.generateCompletion(messages)).rejects.toThrow(
      'Network error'
    );
  });
});
