import type { ConsumerQueueDefinition } from '@common/messaging/rabbitmq/queue-topology';
import type { IntegrationEvent } from './integration-event';

export const ORDER_EVENTS_EXCHANGE = 'order.events';
export const INVENTORY_EVENTS_EXCHANGE = 'inventory.events';

export const StockCommandType = {
  ReservationRequested: 'StockReservationRequested',
  ReleaseRequested: 'StockReleaseRequested',
  CommitRequested: 'StockCommitRequested',
} as const;
export type StockCommandType =
  (typeof StockCommandType)[keyof typeof StockCommandType];

export const StockEventType = {
  Reserved: 'StockReserved',
  ReservationRejected: 'StockReservationRejected',
  Released: 'StockReleased',
  Committed: 'StockCommitted',
  SnapshotPublished: 'StockSnapshotPublished',
} as const;
export type StockEventType =
  (typeof StockEventType)[keyof typeof StockEventType];

export const STOCK_COMMAND_ROUTING_KEYS: Record<StockCommandType, string> = {
  [StockCommandType.ReservationRequested]: 'stock.reservation-requested',
  [StockCommandType.ReleaseRequested]: 'stock.release-requested',
  [StockCommandType.CommitRequested]: 'stock.commit-requested',
};

export const STOCK_EVENT_ROUTING_KEYS: Record<StockEventType, string> = {
  [StockEventType.Reserved]: 'stock.reserved',
  [StockEventType.ReservationRejected]: 'stock.reservation-rejected',
  [StockEventType.Released]: 'stock.released',
  [StockEventType.Committed]: 'stock.committed',
  [StockEventType.SnapshotPublished]: 'stock.snapshot-published',
};

export const STOCK_COMMANDS_QUEUE: ConsumerQueueDefinition = {
  name: 'inventory.stock-commands',
  bindings: Object.values(STOCK_COMMAND_ROUTING_KEYS).map((routingKey) => ({
    exchange: ORDER_EVENTS_EXCHANGE,
    routingKey,
  })),
  prefetch: 20,
};

export const STOCK_EVENTS_QUEUE: ConsumerQueueDefinition = {
  name: 'order.inventory-events',
  bindings: [{ exchange: INVENTORY_EVENTS_EXCHANGE, routingKey: 'stock.#' }],
  prefetch: 50,
};

export type StockCommandPayload = {
  orderId: string;
  productId: string;
  quantity: number;
};

export type StockLevels = {
  productId: string;
  stock: number;
  reserved: number;
};

export type StockChangedPayload = StockLevels & {
  orderId: string;
  quantity: number;
};

export const StockRejectionReason = {
  SoldOut: 'SOLD_OUT',
  ProductNotFound: 'PRODUCT_NOT_FOUND',
} as const;
export type StockRejectionReason =
  (typeof StockRejectionReason)[keyof typeof StockRejectionReason];

export type StockReservationRejectedPayload = StockChangedPayload & {
  reason: StockRejectionReason;
};

export type StockCommand = IntegrationEvent<
  StockCommandType,
  StockCommandPayload
>;

export type StockEvent =
  | IntegrationEvent<typeof StockEventType.Reserved, StockChangedPayload>
  | IntegrationEvent<
      typeof StockEventType.ReservationRejected,
      StockReservationRejectedPayload
    >
  | IntegrationEvent<typeof StockEventType.Released, StockChangedPayload>
  | IntegrationEvent<typeof StockEventType.Committed, StockChangedPayload>
  | IntegrationEvent<typeof StockEventType.SnapshotPublished, StockLevels>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStockCommandFields(
  payload: unknown,
): payload is StockCommandPayload {
  return (
    isRecord(payload) &&
    typeof payload.orderId === 'string' &&
    typeof payload.productId === 'string' &&
    typeof payload.quantity === 'number' &&
    Number.isInteger(payload.quantity) &&
    payload.quantity > 0
  );
}

function hasStockLevels(payload: unknown): payload is StockLevels {
  return (
    isRecord(payload) &&
    typeof payload.productId === 'string' &&
    typeof payload.stock === 'number' &&
    typeof payload.reserved === 'number'
  );
}

export function isStockCommand(event: IntegrationEvent): event is StockCommand {
  return (
    Object.values<string>(StockCommandType).includes(event.type) &&
    hasStockCommandFields(event.payload)
  );
}

export function isStockEvent(event: IntegrationEvent): event is StockEvent {
  if (!hasStockLevels(event.payload)) {
    return false;
  }
  if (event.type === StockEventType.SnapshotPublished) {
    return true;
  }
  return (
    Object.values<string>(StockEventType).includes(event.type) &&
    hasStockCommandFields(event.payload)
  );
}
