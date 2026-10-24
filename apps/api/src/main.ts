import { AllExceptionsFilter } from '@common/filter/exception.filter';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dataSource from 'src/config/data-source';
import { initSwagger } from 'src/config/swagger.config';
import { createValidationPipe } from 'src/config/validation-pipe.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  app.useGlobalPipes(createValidationPipe());

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',') : false,
    credentials: true,
  });

  app.use(cookieParser());

  if (process.env.NODE_ENV !== 'test') {
    await dataSource.initialize();
  }

  initSwagger(app);

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
