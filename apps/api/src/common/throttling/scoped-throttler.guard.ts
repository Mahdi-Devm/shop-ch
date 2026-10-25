import { ApiException } from '@common/exceptions/api.exception';
import {
  IP_THROTTLER,
  USER_THROTTLER,
} from '@common/throttling/throttler-names';
import type { ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

abstract class ScopedThrottlerGuard extends ThrottlerGuard {
  protected abstract readonly throttlerName: string;
  private readonly storageLogger = new Logger('Throttling');

  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== this.throttlerName) {
      return true;
    }

    try {
      return await super.handleRequest(requestProps);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.storageLogger.warn(
        `Rate limit storage unavailable, allowing request: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return true;
    }
  }

  protected override throwThrottlingException(
    context: ExecutionContext,
    limitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const retryAfterSeconds = Math.max(1, limitDetail.timeToBlockExpire);
    response.setHeader('Retry-After', String(retryAfterSeconds));
    throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED');
  }
}

@Injectable()
export class IpThrottlerGuard extends ScopedThrottlerGuard {
  protected readonly throttlerName = IP_THROTTLER;
}

@Injectable()
export class UserThrottlerGuard extends ScopedThrottlerGuard {
  protected readonly throttlerName = USER_THROTTLER;
}
