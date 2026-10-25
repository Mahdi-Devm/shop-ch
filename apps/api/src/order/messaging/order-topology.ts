import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import {
  PAYMENT_EVENTS_EXCHANGE,
  PAYMENT_EVENT_ROUTING_KEYS,
} from '@common/messaging/contracts/payment-events';
import {
  ORDER_EVENTS_EXCHANGE,
  STOCK_COMMANDS_QUEUE,
  STOCK_EVENTS_QUEUE,
} from '@common/messaging/contracts/stock-events';
import type {
  ConsumerQueueDefinition,
  TopologySetup,
} from '@common/messaging/rabbitmq/queue-topology';
import {
  assertConsumerQueue,
  assertDelayQueue,
  assertTopicExchange,
  delayQueueName,
} from '@common/messaging/rabbitmq/queue-topology';
import type { ConfigService } from '@nestjs/config';
import type { OrderEnvironment } from '@order/config/order-environment';

export const RESERVATION_EXPIRY_QUEUE: ConsumerQueueDefinition = {
  name: 'order.reservation-expiry',
  bindings: [],
  prefetch: 50,
};

export const PAYMENT_EVENTS_QUEUE: ConsumerQueueDefinition = {
  name: 'order.payment-events',
  bindings: Object.values(PAYMENT_EVENT_ROUTING_KEYS).map((routingKey) => ({
    exchange: PAYMENT_EVENTS_EXCHANGE,
    routingKey,
  })),
  prefetch: 50,
};

export const RESERVATION_EXPIRY_SCHEDULED = 'ReservationExpiryScheduled';

export type ReservationExpiryScheduled = IntegrationEvent<
  typeof RESERVATION_EXPIRY_SCHEDULED,
  { orderId: string }
>;

export function isReservationExpiryScheduled(
  event: IntegrationEvent,
): event is ReservationExpiryScheduled {
  const payload = event.payload as Record<string, unknown>;
  return (
    event.type === RESERVATION_EXPIRY_SCHEDULED &&
    typeof payload.orderId === 'string'
  );
}

export function reservationExpiryDelayQueue(reservationTtlMs: number): string {
  return delayQueueName(RESERVATION_EXPIRY_QUEUE.name, reservationTtlMs);
}

export function createOrderTopology(
  configService: ConfigService<OrderEnvironment, true>,
): TopologySetup {
  const reservationTtlMs = configService.get('RESERVATION_TTL_MS', {
    infer: true,
  });
  const retryDelayMs = configService.get('MESSAGE_RETRY_DELAY_MS', {
    infer: true,
  });

  return async (channel) => {
    await assertTopicExchange(channel, ORDER_EVENTS_EXCHANGE);
    await assertTopicExchange(channel, PAYMENT_EVENTS_EXCHANGE);
    await assertConsumerQueue(channel, STOCK_COMMANDS_QUEUE, retryDelayMs);
    await assertConsumerQueue(channel, STOCK_EVENTS_QUEUE, retryDelayMs);
    await assertConsumerQueue(channel, RESERVATION_EXPIRY_QUEUE, retryDelayMs);
    await assertDelayQueue(
      channel,
      RESERVATION_EXPIRY_QUEUE.name,
      reservationTtlMs,
    );
  };
}
