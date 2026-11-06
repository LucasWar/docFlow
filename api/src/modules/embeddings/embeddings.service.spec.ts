import { ServiceUnavailableException } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { EmbeddingsService } from './embeddings.service';

jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  const originalFetch = global.fetch;
  const validVector = Array.from({ length: 384 }, (_, index) =>
    index === 0 ? 3 : 0,
  );

  beforeEach(() => {
    service = new EmbeddingsService();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('requests a query embedding and returns its normalized vector', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embeddings: [validVector] }),
    });

    const embedding = await service.embedQuery('question');

    expect(embedding).toHaveLength(384);
    expect(embedding[0]).toBe(1);
    expect(embedding.slice(1).every((value) => value === 0)).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ texts: ['question'], kind: 'query' }),
      }),
    );
  });

  it('rejects empty or whitespace-only queries without making a request', async () => {
    await expect(service.embedQuery('')).rejects.toThrow(
      'O texto da busca não pode ser vazio',
    );
    await expect(service.embedQuery('   ')).rejects.toThrow(
      'O texto da busca não pode ser vazio',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed or non-finite vectors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embeddings: [[NaN]] }),
    });

    await expect(service.embedQuery('question')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails immediately for a non-retryable HTTP response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad request',
      headers: new Headers(),
    });

    await expect(service.embedQuery('question')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries transient server responses up to the configured limit', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [validVector] }),
      });

    await expect(service.embedQuery('question')).resolves.toHaveLength(384);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
