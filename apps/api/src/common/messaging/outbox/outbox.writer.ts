import type { OutboundMessage } from '@common/messaging/rabbitmq/rabbitmq.publisher';
import type { EntityManager } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';

export async function appendToOutbox(
  manager: EntityManager,
  message: OutboundMessage,
): Promise<void> {
  const { event } = message;
  await manager.insert(OutboxEventEntity, {
    eventId: event.eventId,
    aggregateId: event.aggregateId,
    version: event.version,
    type: event.type,
    payload: event.payload as object,
    occurredAt: new Date(event.occurredAt),
    exchange: message.exchange,
    routingKey: message.routingKey,
    publishedAt: null,
    attempts: 0,
    lastError: null,
  });
}

export function toOutboundMessage(row: OutboxEventEntity): OutboundMessage {
  return {
    exchange: row.exchange,
    routingKey: row.routingKey,
    event: {
      eventId: row.eventId,
      aggregateId: row.aggregateId,
      version: row.version,
      occurredAt: row.occurredAt.toISOString(),
      type: row.type,
      payload: row.payload,
    },
  };
}
