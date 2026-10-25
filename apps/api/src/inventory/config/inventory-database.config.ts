import type { PostgresConnectionSettings } from '@common/database/postgres-options';
import { createPostgresOptions } from '@common/database/postgres-options';
import type { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { InventoryEnvironment } from './inventory-environment';

export const INVENTORY_ENTITIES = [];

export function createInventoryDataSourceOptions(
  settings: PostgresConnectionSettings,
): DataSourceOptions {
  return createPostgresOptions(
    settings,
    INVENTORY_ENTITIES,
    join(__dirname, '..', 'migrations'),
  );
}

export function inventoryDatabaseSettings(
  environment: Pick<
    InventoryEnvironment,
    | 'INVENTORY_DB_HOST'
    | 'INVENTORY_DB_PORT'
    | 'POSTGRES_USER'
    | 'POSTGRES_PASSWORD'
    | 'INVENTORY_DB'
  >,
): PostgresConnectionSettings {
  return {
    host: environment.INVENTORY_DB_HOST,
    port: environment.INVENTORY_DB_PORT,
    username: environment.POSTGRES_USER,
    password: environment.POSTGRES_PASSWORD,
    database: environment.INVENTORY_DB,
  };
}

export function inventoryDatabaseSettingsFromConfig(
  configService: ConfigService<InventoryEnvironment, true>,
): PostgresConnectionSettings {
  return inventoryDatabaseSettings({
    INVENTORY_DB_HOST: configService.get('INVENTORY_DB_HOST', { infer: true }),
    INVENTORY_DB_PORT: configService.get('INVENTORY_DB_PORT', { infer: true }),
    POSTGRES_USER: configService.get('POSTGRES_USER', { infer: true }),
    POSTGRES_PASSWORD: configService.get('POSTGRES_PASSWORD', { infer: true }),
    INVENTORY_DB: configService.get('INVENTORY_DB', { infer: true }),
  });
}
