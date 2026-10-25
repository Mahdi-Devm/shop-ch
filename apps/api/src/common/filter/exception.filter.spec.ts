import { ApiException } from '@common/exceptions/api.exception';
import { AllExceptionsFilter } from '@common/filter/exception.filter';
import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';

type CapturedResponse = { status?: number; body?: unknown };

function createHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const request = { method: 'GET', originalUrl: '/api/orders/1?token=secret' };

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('passes api exception codes and details through unchanged', () => {
    const captured: CapturedResponse = {};
    filter.catch(
      new ApiException(HttpStatus.CONFLICT, 'DUPLICATE_IDEMPOTENCY_KEY', {
        orderId: 'order-1',
      }),
      createHost(captured),
    );

    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.body).toEqual({
      code: 'DUPLICATE_IDEMPOTENCY_KEY',
      orderId: 'order-1',
    });
  });

  it('maps plain http exceptions to a code derived from the status', () => {
    const captured: CapturedResponse = {};
    filter.catch(new BadRequestException('bad input'), createHost(captured));

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toEqual({
      code: 'BAD_REQUEST',
      message: 'bad input',
    });
  });

  it('hides internal details of unexpected errors', () => {
    const captured: CapturedResponse = {};
    filter.catch(
      new Error('relation "orders" does not exist at /srv/app.js:12'),
      createHost(captured),
    );

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('answers 503 when a dependency is unreachable', () => {
    const captured: CapturedResponse = {};
    const connectionRefused = Object.assign(new Error('connect refused'), {
      code: 'ECONNREFUSED',
    });
    filter.catch(connectionRefused, createHost(captured));

    expect(captured.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(captured.body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable',
    });
  });
});
