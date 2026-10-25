import { createHttpService } from '@common/bootstrap/create-http-service';
import { loadEnvironment } from '@common/config/load-environment';
import { runMigrationsWithLock } from '@common/database/run-migrations-with-lock';
import { createLogger } from '@common/logging/create-logger';
import { Logger } from '@nestjs/common';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettings,
} from './config/inventory-database.config';
import { InventoryEnvironment } from './config/inventory-environment';
import { InventoryAppModule } from './inventory-app.module';
import { seedFlashSaleProduct } from './seed/seed-flash-sale-product';

async function bootstrap(): Promise<void> {
  Logger.overrideLogger(createLogger('inventory'));
  const environment = loadEnvironment(InventoryEnvironment);

  await runMigrationsWithLock(
    createInventoryDataSourceOptions(inventoryDatabaseSettings(environment)),
    seedFlashSaleProduct,
  );

  const app = await createHttpService({
    serviceName: 'inventory',
    rootModule: InventoryAppModule,
  });

  await app.listen(environment.PORT_INVENTORY);
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Inventory service failed to start',
    error instanceof Error ? error.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
