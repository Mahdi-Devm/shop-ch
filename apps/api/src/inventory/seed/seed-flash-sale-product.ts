import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { StockLevels } from '@common/messaging/contracts/stock-events';
import {
  INVENTORY_EVENTS_EXCHANGE,
  STOCK_EVENT_ROUTING_KEYS,
  StockEventType,
} from '@common/messaging/contracts/stock-events';
import { appendToOutbox } from '@common/messaging/outbox/outbox.writer';
import { ProductEntity } from '@inventory/modules/stock/entities/product.entity';
import type { EntityManager } from 'typeorm';

export const FLASH_SALE_PRODUCT = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Flash Sale Product',
  initialStock: 500,
} as const;

export async function seedFlashSaleProduct(
  manager: EntityManager,
): Promise<void> {
  await manager.transaction(async (transaction) => {
    await transaction
      .createQueryBuilder()
      .insert()
      .into(ProductEntity)
      .values({
        id: FLASH_SALE_PRODUCT.id,
        name: FLASH_SALE_PRODUCT.name,
        initialStock: FLASH_SALE_PRODUCT.initialStock,
        stock: FLASH_SALE_PRODUCT.initialStock,
        reserved: 0,
        sold: 0,
        version: 1,
      })
      .orIgnore()
      .execute();

    const product = await transaction.findOneByOrFail(ProductEntity, {
      id: FLASH_SALE_PRODUCT.id,
    });
    const snapshot: StockLevels = {
      productId: product.id,
      stock: product.stock,
      reserved: product.reserved,
    };

    await appendToOutbox(transaction, {
      exchange: INVENTORY_EVENTS_EXCHANGE,
      routingKey: STOCK_EVENT_ROUTING_KEYS[StockEventType.SnapshotPublished],
      event: createIntegrationEvent({
        aggregateId: product.id,
        version: product.version,
        type: StockEventType.SnapshotPublished,
        payload: snapshot,
      }),
    });
  });
}
