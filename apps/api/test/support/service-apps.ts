import { configureHttpService } from '@common/bootstrap/create-http-service';
import { loadEnvironment } from '@common/config/load-environment';
import { runMigrationsWithLock } from '@common/database/run-migrations-with-lock';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettings,
} from '@order/config/order-database.config';
import { OrderEnvironment } from '@order/config/order-environment';
import { OrderAppModule } from '@order/order-app.module';

export async function createOrderApp(
  extraControllers: Type<unknown>[] = [],
): Promise<NestExpressApplication> {
  await runMigrationsWithLock(
    createOrderDataSourceOptions(
      orderDatabaseSettings(loadEnvironment(OrderEnvironment)),
    ),
  );

  const moduleRef = await Test.createTestingModule({
    imports: [OrderAppModule],
    controllers: extraControllers,
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureHttpService(app, []);
  await app.listen(0);
  return app;
}
