import { randomUUID } from 'node:crypto';

export type IntegrationEvent<
  TType extends string = string,
  TPayload = unknown,
> = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: string;
  type: TType;
  payload: TPayload;
};

export class InvalidIntegrationEventError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createIntegrationEvent<TType extends string, TPayload>(
  fields: Pick<
    IntegrationEvent<TType, TPayload>,
    'aggregateId' | 'version' | 'type' | 'payload'
  >,
): IntegrationEvent<TType, TPayload> {
  return {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...fields,
  };
}

export function parseIntegrationEvent(content: Buffer): IntegrationEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.toString('utf8'));
  } catch {
    throw new InvalidIntegrationEventError('Message body is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidIntegrationEventError('Message body is not an object');
  }

  const candidate = parsed as Record<string, unknown>;
  const { eventId, aggregateId, version, occurredAt, type, payload } =
    candidate;

  if (
    typeof eventId !== 'string' ||
    !UUID_PATTERN.test(eventId) ||
    typeof aggregateId !== 'string' ||
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    typeof occurredAt !== 'string' ||
    typeof type !== 'string' ||
    typeof payload !== 'object' ||
    payload === null
  ) {
    throw new InvalidIntegrationEventError('Message envelope is malformed');
  }

  return { eventId, aggregateId, version, occurredAt, type, payload };
}
