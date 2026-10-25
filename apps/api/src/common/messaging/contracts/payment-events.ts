import type { IntegrationEvent } from './integration-event';

export const PAYMENT_EVENTS_EXCHANGE = 'payment.events';

export const PaymentEventType = {
  Succeeded: 'PaymentSucceeded',
  Failed: 'PaymentFailed',
} as const;
export type PaymentEventType =
  (typeof PaymentEventType)[keyof typeof PaymentEventType];

export const PAYMENT_EVENT_ROUTING_KEYS: Record<PaymentEventType, string> = {
  [PaymentEventType.Succeeded]: 'payment.succeeded',
  [PaymentEventType.Failed]: 'payment.failed',
};

export type PaymentPayload = {
  orderId: string;
};

export type PaymentEvent = IntegrationEvent<PaymentEventType, PaymentPayload>;

export function isPaymentEvent(event: IntegrationEvent): event is PaymentEvent {
  const payload = event.payload as Record<string, unknown>;
  return (
    Object.values<string>(PaymentEventType).includes(event.type) &&
    typeof payload.orderId === 'string'
  );
}
