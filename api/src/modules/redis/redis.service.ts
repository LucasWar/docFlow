import { Injectable } from '@nestjs/common';
import { RedisRepository } from './redis.repository';

@Injectable()
export class RedisService {
  constructor(private readonly redisRepo: RedisRepository) {}

  async saveReponse(idempotencyKey: string, data: string) {
    await this.redisRepo.setWithExpiry(
      'IDEMPOTENCY_KEY',
      idempotencyKey,
      data,
      15,
    );
  }

  async getResponse(idempotencyKey: string): Promise<string | null> {
    const cache = await this.redisRepo.get('IDEMPOTENCY_KEY', idempotencyKey);
    return cache;
  }
}
