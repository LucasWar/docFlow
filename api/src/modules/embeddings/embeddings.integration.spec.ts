import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService integration', () => {
  let moduleRef: TestingModule;
  let service: EmbeddingsService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          Array.from({ length: 384 }, (_, index) => (index === 0 ? 2 : 0)),
        ],
      }),
    });
    moduleRef = await Test.createTestingModule({
      providers: [EmbeddingsService],
    }).compile();
    service = moduleRef.get(EmbeddingsService);
  });

  afterEach(async () => {
    await moduleRef.close();
    global.fetch = originalFetch;
  });

  it('sends the query protocol to the configured endpoint and normalizes its response', async () => {
    await expect(service.embedQuery('integration question')).resolves.toEqual(
      expect.arrayContaining([1]),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: ['integration question'],
          kind: 'query',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
