import type { PostgresConnectionSettings } from '@common/database/postgres-options';
import { createPostgresOptions } from '@common/database/postgres-options';
import type { ConfigService } from '@nestjs/config';
import { ProcessedEventEntity } from '@common/messaging/inbox/processed-event.entity';
import { OutboxEventEntity } from '@common/messaging/outbox/outbox-event.entity';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { ProductEntity } from '../modules/stock/entities/product.entity';
import { ReservationEntity } from '../modules/stock/entities/reservation.entity';
import type { InventoryEnvironment } from './inventory-environment';

export const INVENTORY_ENTITIES = [
  ProductEntity,
  ReservationEntity,
  OutboxEventEntity,
  ProcessedEventEntity,
];

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
