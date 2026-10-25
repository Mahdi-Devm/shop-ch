import { loadEnvironment } from '@common/config/load-environment';
import { runMigrationsWithLock } from '@common/database/run-migrations-with-lock';
import { Logger } from '@nestjs/common';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettings,
} from '../config/inventory-database.config';
import { InventoryEnvironment } from '../config/inventory-environment';
import { seedFlashSaleProduct } from './seed-flash-sale-product';

runMigrationsWithLock(
  createInventoryDataSourceOptions(
    inventoryDatabaseSettings(loadEnvironment(InventoryEnvironment)),
  ),
  seedFlashSaleProduct,
)
  .then(() => Logger.log('Flash sale product seeded', 'Seed'))
  .catch((error: unknown) => {
    Logger.error(
      'Seeding failed',
      error instanceof Error ? error.stack : undefined,
      'Seed',
    );
    process.exit(1);
  });
