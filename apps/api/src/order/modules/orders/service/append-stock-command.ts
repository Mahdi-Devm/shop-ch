import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type {
  StockCommandPayload,
  StockCommandType,
} from '@common/messaging/contracts/stock-events';
import {
  ORDER_EVENTS_EXCHANGE,
  STOCK_COMMAND_ROUTING_KEYS,
} from '@common/messaging/contracts/stock-events';
import { appendToOutbox } from '@common/messaging/outbox/outbox.writer';
import type { EntityManager } from 'typeorm';

export async function appendStockCommand(
  manager: EntityManager,
  type: StockCommandType,
  order: StockCommandPayload & { version: number },
): Promise<void> {
  const payload: StockCommandPayload = {
    orderId: order.orderId,
    productId: order.productId,
    quantity: order.quantity,
  };

  await appendToOutbox(manager, {
    exchange: ORDER_EVENTS_EXCHANGE,
    routingKey: STOCK_COMMAND_ROUTING_KEYS[type],
    event: createIntegrationEvent({
      aggregateId: order.orderId,
      version: order.version,
      type,
      payload,
    }),
  });
}
