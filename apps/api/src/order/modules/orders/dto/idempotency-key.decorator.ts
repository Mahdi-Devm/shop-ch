import { ApiException } from '@common/exceptions/api.exception';
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, HttpStatus } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const value = context
      .switchToHttp()
      .getRequest<Request>()
      .header('idempotency-key');

    if (value === undefined || !isUUID(value, '4')) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'INVALID_IDEMPOTENCY_KEY',
        {
          message: 'Idempotency-Key header must be a UUID v4',
        },
      );
    }
    return value.toLowerCase();
  },
);
