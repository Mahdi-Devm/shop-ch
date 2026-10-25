import {
  ORDER_STATUSES,
  type OrderStatus,
  type OrderStatusEvent,
} from "../assets/@types/orders.types";

const TERMINAL_STATUSES: readonly OrderStatus[] = ["Paid", "Cancelled", "Expired"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: "در انتظار تأیید موجودی",
  Reserved: "رزرو شد؛ در انتظار پرداخت",
  Paid: "پرداخت شد",
  Cancelled: "لغو شد",
  Expired: "مهلت پرداخت تمام شد",
};

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isFailedStatus(status: OrderStatus): boolean {
  return status === "Cancelled" || status === "Expired";
}

export function parseStatusEvent(data: string): OrderStatusEvent | null {
  try {
    const parsed = JSON.parse(data) as Partial<OrderStatusEvent>;
    const status = ORDER_STATUSES.find((candidate) => candidate === parsed.status);
    return status && typeof parsed.version === "number"
      ? { status, version: parsed.version }
      : null;
  } catch {
    return null;
  }
}
