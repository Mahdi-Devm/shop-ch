import { createValidationPipe } from '@common/config/validation-pipe.config';
import { AllExceptionsFilter } from '@common/filter/exception.filter';
import { createLogger } from '@common/logging/create-logger';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export type HttpServiceOptions = {
  serviceName: string;
  rootModule: Type<unknown>;
  corsOrigins?: string[];
};

export async function createHttpService(
  options: HttpServiceOptions,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    options.rootModule,
    { logger: createLogger(options.serviceName), bufferLogs: true },
  );

  configureHttpService(app, options.corsOrigins ?? []);
  return app;
}

export function configureHttpService(
  app: NestExpressApplication,
  corsOrigins: string[],
): void {
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.useBodyParser('json', { limit: '10kb' });
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    exposedHeaders: ['Retry-After'],
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
