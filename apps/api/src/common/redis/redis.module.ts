import { REDIS_CLIENT } from '@common/redis/redis.constants';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Global, Inject, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import Redis from 'ioredis';

export type RedisEnvironment = {
  REDIS_HOST: string;
  REDIS_PORT: number;
};

export function createRedisClient(
  configService: ConfigService<RedisEnvironment, true>,
  connectionName: string,
  overrides: Partial<RedisOptions> = {},
): Redis {
  const logger = new Logger('Redis');
  const client = new Redis({
    host: configService.get('REDIS_HOST', { infer: true }),
    port: configService.get('REDIS_PORT', { infer: true }),
    connectionName,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    ...overrides,
  });

  client.on('error', (error: Error) => {
    logger.warn(`Redis ${connectionName} error: ${error.message}`);
  });

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<RedisEnvironment, true>) =>
        createRedisClient(configService, 'commands'),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
