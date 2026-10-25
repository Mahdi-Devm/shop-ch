export const ORDER_STATUSES = ["Pending", "Reserved", "Paid", "Cancelled", "Expired"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderView = {
  orderId: string;
  status: OrderStatus;
  version: number;
  productId: string;
  quantity: number;
  createdAt: string;
};

export type OrderStatusEvent = {
  status: OrderStatus;
  version: number;
};

export type PaymentOutcome = "succeeded" | "failed";
