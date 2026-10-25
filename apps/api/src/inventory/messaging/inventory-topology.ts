import {
  INVENTORY_EVENTS_EXCHANGE,
  STOCK_EVENTS_QUEUE,
} from '@common/messaging/contracts/stock-events';
import type { TopologySetup } from '@common/messaging/rabbitmq/queue-topology';
import {
  assertConsumerQueue,
  assertTopicExchange,
} from '@common/messaging/rabbitmq/queue-topology';
import type { ConfigService } from '@nestjs/config';
import type { InventoryEnvironment } from '@inventory/config/inventory-environment';

export function createInventoryTopology(
  configService: ConfigService<InventoryEnvironment, true>,
): TopologySetup {
  const retryDelayMs = configService.get('MESSAGE_RETRY_DELAY_MS', {
    infer: true,
  });

  return async (channel) => {
    await assertTopicExchange(channel, INVENTORY_EVENTS_EXCHANGE);
    await assertConsumerQueue(channel, STOCK_EVENTS_QUEUE, retryDelayMs);
  };
}
