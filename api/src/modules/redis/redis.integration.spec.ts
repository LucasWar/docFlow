import { Test, TestingModule } from '@nestjs/testing';
import { RedisRepository } from './redis.repository';
import { RedisService } from './redis.service';

describe('RedisService integration', () => {
  let moduleRef: TestingModule;
  let service: RedisService;
  let moduleClosed: boolean;
  const redisClient = {
    set: jest.fn(),
    get: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleClosed = false;
    moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        RedisRepository,
        { provide: 'RedisClient', useValue: redisClient },
      ],
    }).compile();
    service = moduleRef.get(RedisService);
  });

  afterEach(async () => {
    if (!moduleClosed) {
      await moduleRef.close();
    }
  });

  it('writes and reads an idempotency response using the repository key format', async () => {
    redisClient.set.mockResolvedValueOnce('OK');
    redisClient.get.mockResolvedValueOnce('{"result":"done"}');

    await service.saveReponse('request-1', '{"result":"done"}');
    await expect(service.getResponse('request-1')).resolves.toBe(
      '{"result":"done"}',
    );

    expect(redisClient.set).toHaveBeenCalledWith(
      'IDEMPOTENCY_KEY:request-1',
      '{"result":"done"}',
      'EX',
      15,
      'NX',
    );
    expect(redisClient.get).toHaveBeenCalledWith('IDEMPOTENCY_KEY:request-1');
  });

  it('disconnects the configured Redis client when the module is closed', async () => {
    await moduleRef.close();
    moduleClosed = true;

    expect(redisClient.disconnect).toHaveBeenCalledTimes(1);
  });
});
