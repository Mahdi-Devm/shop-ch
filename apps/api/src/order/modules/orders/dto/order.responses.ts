import type { OrderEntity, OrderStatus } from '../entities/order.entity';

export type OrderCreatedResponse = {
  orderId: string;
  status: OrderStatus;
  version: number;
};

export type OrderResponse = OrderCreatedResponse & {
  productId: string;
  quantity: number;
  createdAt: string;
};

export type OrderStatusEvent = {
  status: OrderStatus;
  version: number;
};

export function toOrderResponse(order: OrderEntity): OrderResponse {
  return {
    orderId: order.id,
    status: order.status,
    version: order.version,
    productId: order.productId,
    quantity: order.quantity,
    createdAt: order.createdAt.toISOString(),
  };
}
