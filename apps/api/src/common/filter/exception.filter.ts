import { isInfrastructureUnavailable } from '@common/exceptions/is-infrastructure-unavailable';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

type ErrorResponseBody = { code: string } & Record<string, unknown>;

function defaultCode(status: number): string {
  return DEFAULT_CODES[status] ?? 'ERROR';
}

function bodyFromHttpException(exception: HttpException): ErrorResponseBody {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { code: defaultCode(status), message: response };
  }

  const responseFields = response as Record<string, unknown>;
  if (typeof responseFields.code === 'string') {
    return { ...responseFields, code: responseFields.code };
  }

  const message =
    typeof responseFields.message === 'string'
      ? responseFields.message
      : exception.message;
  return { code: defaultCode(status), message };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (response.headersSent) {
      return;
    }

    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(bodyFromHttpException(exception));
      return;
    }

    const path = request.originalUrl.split('?')[0];

    if (isInfrastructureUnavailable(exception)) {
      this.logger.warn(
        `Dependency unavailable on ${request.method} ${path}: ${exception instanceof Error ? exception.message : 'unknown'}`,
      );
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' });
      return;
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${path}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}
