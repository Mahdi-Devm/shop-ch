import { loadEnvironment } from '@common/config/load-environment';
import { runMigrationsWithLock } from '@common/database/run-migrations-with-lock';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettings,
} from '@inventory/config/inventory-database.config';
import { InventoryEnvironment } from '@inventory/config/inventory-environment';
import { seedFlashSaleProduct } from '@inventory/seed/seed-flash-sale-product';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettings,
} from '@order/config/order-database.config';
import { OrderEnvironment } from '@order/config/order-environment';
import { DataSource } from 'typeorm';

export async function connectInventoryDatabase(): Promise<DataSource> {
  const options = createInventoryDataSourceOptions(
    inventoryDatabaseSettings(loadEnvironment(InventoryEnvironment)),
  );
  await runMigrationsWithLock(options, seedFlashSaleProduct);
  return new DataSource(options).initialize();
}

export async function connectOrderDatabase(): Promise<DataSource> {
  const options = createOrderDataSourceOptions(
    orderDatabaseSettings(loadEnvironment(OrderEnvironment)),
  );
  await runMigrationsWithLock(options);
  return new DataSource(options).initialize();
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
  await dataSource.transaction(async (manager) => {
    await manager.query(
      `UPDATE products
          SET initial_stock = 500, stock = 500, reserved = 0, sold = 0,
              version = 1
        WHERE id = $1`,
      [productId],
    );
    await manager.query('DELETE FROM reservations');
    await manager.query('DELETE FROM processed_events');
    await manager.query('DELETE FROM outbox_events');
  });
}

export async function resetOrderDatabase(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    for (const table of [
      'orders',
      'idempotency_keys',
      'outbox_events',
      'processed_events',
    ]) {
      await manager.query(`DELETE FROM ${table}`);
    }
  });
}

export async function setFlashSaleStock(
  inventory: DataSource,
  order: DataSource,
  productId: string,
  stock: number,
): Promise<void> {
  const version = await inventory.transaction(async (manager) => {
    const [rows]: [{ version: number }[], number] = await manager.query(
      `UPDATE products
          SET initial_stock = $2, stock = $2, reserved = 0, sold = 0,
              version = version + 1000
        WHERE id = $1
        RETURNING version`,
      [productId, stock],
    );
    await manager.query('DELETE FROM reservations');
    await manager.query('DELETE FROM processed_events');
    await manager.query('DELETE FROM outbox_events');
    return rows[0]?.version;
  });
  if (version === undefined) {
    throw new Error(`Product ${productId} not found`);
  }
  await order.query(
    `INSERT INTO product_stock_view (product_id, stock, reserved, version)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (product_id) DO UPDATE
       SET stock = EXCLUDED.stock, reserved = 0, version = EXCLUDED.version`,
    [productId, stock, version],
  );
}

export async function countOrdersByStatus(
  dataSource: DataSource,
): Promise<Record<string, number>> {
  const rows: { status: string; count: string }[] = await dataSource.query(
    'SELECT status, count(*) FROM orders GROUP BY status',
  );
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

export async function orderStatus(
  dataSource: DataSource,
  orderId: string,
): Promise<string | undefined> {
  const rows: { status: string }[] = await dataSource.query(
    'SELECT status FROM orders WHERE id = $1',
    [orderId],
  );
  return rows[0]?.status;
}
