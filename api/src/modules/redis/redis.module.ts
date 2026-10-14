import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisClientFactory } from './redis.provider';
import { RedisRepository } from './redis.repository';

@Global()
@Module({
  providers: [RedisService, RedisClientFactory, RedisRepository],
  exports: [RedisService],
})
export class RedisModule {}
