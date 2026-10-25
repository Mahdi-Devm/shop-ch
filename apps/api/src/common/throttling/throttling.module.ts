import { REDIS_CLIENT } from '@common/redis/redis.constants';
import {
  IP_THROTTLER,
  USER_THROTTLER,
} from '@common/throttling/throttler-names';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type { ExecutionContext } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import type Redis from 'ioredis';

export type ThrottlingEnvironment = {
  THROTTLE_IP_LIMIT: number;
  THROTTLE_USER_LIMIT: number;
  THROTTLE_TTL_MS: number;
};

function requestOf(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (
        configService: ConfigService<ThrottlingEnvironment, true>,
        redis: Redis,
      ) => {
        const ttl = configService.get('THROTTLE_TTL_MS', { infer: true });
        return {
          throttlers: [
            {
              name: IP_THROTTLER,
              ttl,
              limit: configService.get('THROTTLE_IP_LIMIT', { infer: true }),
              getTracker: (_request, context) =>
                requestOf(context).ip ?? 'unknown',
            },
            {
              name: USER_THROTTLER,
              ttl,
              limit: configService.get('THROTTLE_USER_LIMIT', { infer: true }),
              skipIf: (context) => requestOf(context).user === undefined,
              getTracker: (_request, context) =>
                requestOf(context).user?.userId ?? 'anonymous',
            },
          ],
          generateKey: (_context, tracker, throttlerName) =>
            `throttle:${throttlerName}:${tracker}`,
          storage: new ThrottlerStorageRedisService(redis),
          setHeaders: false,
        };
      },
    }),
  ],
})
export class ThrottlingModule {}
