import { loadEnvironment } from '@common/config/load-environment';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettings,
} from '@inventory/config/inventory-database.config';
import { InventoryEnvironment } from '@inventory/config/inventory-environment';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettings,
} from '@order/config/order-database.config';
import { OrderEnvironment } from '@order/config/order-environment';
import { DataSource } from 'typeorm';

export async function connectInventoryDatabase(): Promise<DataSource> {
  return new DataSource(
    createInventoryDataSourceOptions(
      inventoryDatabaseSettings(loadEnvironment(InventoryEnvironment)),
    ),
  ).initialize();
}

export async function connectOrderDatabase(): Promise<DataSource> {
  return new DataSource(
    createOrderDataSourceOptions(
      orderDatabaseSettings(loadEnvironment(OrderEnvironment)),
    ),
  ).initialize();
}

export async function countRows(
  dataSource: DataSource,
  sql: string,
  parameters: unknown[] = [],
): Promise<number> {
  const rows: { count: string }[] = await dataSource.query(sql, parameters);
  return Number(rows[0]?.count ?? 0);
}

export type ProductRow = {
  stock: number;
  reserved: number;
  sold: number;
  version: number;
};

export async function readInventoryProduct(
  dataSource: DataSource,
  productId: string,
): Promise<ProductRow> {
  const rows: ProductRow[] = await dataSource.query(
    'SELECT stock, reserved, sold, version FROM products WHERE id = $1',
    [productId],
  );
  const [product] = rows;
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }
  return product;
}

export async function resetInventory(
  dataSource: DataSource,
  productId: string,
): Promise<void> {
  await dataSource.query(
    'TRUNCATE reservations, processed_events, outbox_events',
  );
  await dataSource.query(
    'UPDATE products SET stock = initial_stock, reserved = 0, sold = 0, version = 1 WHERE id = $1',
    [productId],
  );
}
