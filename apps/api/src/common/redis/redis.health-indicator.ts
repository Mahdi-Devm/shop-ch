import type { HealthIndicator } from '@common/health/health-indicator';
import { REDIS_CLIENT } from '@common/redis/redis.constants';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator implements HealthIndicator {
  readonly name = 'redis';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async check(): Promise<void> {
    await this.redis.ping();
  }
}
