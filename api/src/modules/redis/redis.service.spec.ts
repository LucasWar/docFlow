import { Test, TestingModule } from '@nestjs/testing';
import { RedisRepository } from './redis.repository';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let moduleRef: TestingModule;
  let service: RedisService;
  let repository: jest.Mocked<Pick<RedisRepository, 'setWithExpiry' | 'get'>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      setWithExpiry: jest.fn(),
      get: jest.fn(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: RedisRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(RedisService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('stores idempotency responses with the configured namespace and TTL', async () => {
    await service.saveReponse('request-1', '{"ok":true}');

    expect(repository.setWithExpiry).toHaveBeenCalledWith(
      'IDEMPOTENCY_KEY',
      'request-1',
      '{"ok":true}',
      15,
    );
  });

  it('returns the cached response or null on a cache miss', async () => {
    repository.get
      .mockResolvedValueOnce('{"ok":true}')
      .mockResolvedValueOnce(null);

    await expect(service.getResponse('request-1')).resolves.toBe('{"ok":true}');
    await expect(service.getResponse('missing')).resolves.toBeNull();
    expect(repository.get).toHaveBeenNthCalledWith(
      1,
      'IDEMPOTENCY_KEY',
      'request-1',
    );
  });
});
