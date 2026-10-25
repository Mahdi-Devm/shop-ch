import type { PostgresConnectionSettings } from '@common/database/postgres-options';
import { createPostgresOptions } from '@common/database/postgres-options';
import type { ConfigService } from '@nestjs/config';
import { ProcessedEventEntity } from '@common/messaging/inbox/processed-event.entity';
import { OutboxEventEntity } from '@common/messaging/outbox/outbox-event.entity';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { IdempotencyKeyEntity } from '../modules/orders/entities/idempotency-key.entity';
import { OrderEntity } from '../modules/orders/entities/order.entity';
import { ProductStockViewEntity } from '../modules/products/entities/product-stock-view.entity';
import type { OrderEnvironment } from './order-environment';

export const ORDER_ENTITIES = [
  OrderEntity,
  IdempotencyKeyEntity,
  ProductStockViewEntity,
  OutboxEventEntity,
  ProcessedEventEntity,
];

export function createOrderDataSourceOptions(
  settings: PostgresConnectionSettings,
): DataSourceOptions {
  return createPostgresOptions(
    settings,
    ORDER_ENTITIES,
    join(__dirname, '..', 'migrations'),
  );
}

export function orderDatabaseSettings(
  environment: Pick<
    OrderEnvironment,
    | 'POSTGRES_HOST'
    | 'POSTGRES_PORT'
    | 'POSTGRES_USER'
    | 'POSTGRES_PASSWORD'
    | 'POSTGRES_DB'
  >,
): PostgresConnectionSettings {
  return {
    host: environment.POSTGRES_HOST,
    port: environment.POSTGRES_PORT,
    username: environment.POSTGRES_USER,
    password: environment.POSTGRES_PASSWORD,
    database: environment.POSTGRES_DB,
  };
}

export function orderDatabaseSettingsFromConfig(
  configService: ConfigService<OrderEnvironment, true>,
): PostgresConnectionSettings {
  return orderDatabaseSettings({
    POSTGRES_HOST: configService.get('POSTGRES_HOST', { infer: true }),
    POSTGRES_PORT: configService.get('POSTGRES_PORT', { infer: true }),
    POSTGRES_USER: configService.get('POSTGRES_USER', { infer: true }),
    POSTGRES_PASSWORD: configService.get('POSTGRES_PASSWORD', { infer: true }),
    POSTGRES_DB: configService.get('POSTGRES_DB', { infer: true }),
  });
}
