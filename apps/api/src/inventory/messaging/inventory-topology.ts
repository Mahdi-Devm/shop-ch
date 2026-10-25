import {
  INVENTORY_EVENTS_EXCHANGE,
  ORDER_EVENTS_EXCHANGE,
  STOCK_COMMAND_ROUTING_KEYS,
} from '@common/messaging/contracts/stock-events';
import type {
  ConsumerQueueDefinition,
  TopologySetup,
} from '@common/messaging/rabbitmq/queue-topology';
import { assertTopicExchange } from '@common/messaging/rabbitmq/queue-topology';

export const STOCK_COMMANDS_QUEUE: ConsumerQueueDefinition = {
  name: 'inventory.stock-commands',
  bindings: Object.values(STOCK_COMMAND_ROUTING_KEYS).map((routingKey) => ({
    exchange: ORDER_EVENTS_EXCHANGE,
    routingKey,
  })),
  prefetch: 20,
};

export const inventoryTopology: TopologySetup = async (channel) => {
  await assertTopicExchange(channel, INVENTORY_EVENTS_EXCHANGE);
};
