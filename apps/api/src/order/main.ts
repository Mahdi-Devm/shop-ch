import { createHttpService } from '@common/bootstrap/create-http-service';
import { loadEnvironment } from '@common/config/load-environment';
import { runMigrationsWithLock } from '@common/database/run-migrations-with-lock';
import { createLogger } from '@common/logging/create-logger';
import { Logger } from '@nestjs/common';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettings,
} from './config/order-database.config';
import { OrderEnvironment } from './config/order-environment';
import { OrderAppModule } from './order-app.module';

async function bootstrap(): Promise<void> {
  Logger.overrideLogger(createLogger('order'));
  const environment = loadEnvironment(OrderEnvironment);

  await runMigrationsWithLock(
    createOrderDataSourceOptions(orderDatabaseSettings(environment)),
  );

  const app = await createHttpService({
    serviceName: 'order',
    rootModule: OrderAppModule,
    corsOrigins: environment.CORS_ORIGIN.split(',').filter(Boolean),
  });

  await app.listen(environment.PORT_ORDER);
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Order service failed to start',
    error instanceof Error ? error.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
