import { apiRequest, apiUrl, type ApiResult } from "@/core/lib/api/api-client";
import type { OrderView, PaymentOutcome } from "../assets/@types/orders.types";

export function fetchOrder(orderId: string, token: string): Promise<ApiResult<OrderView>> {
  return apiRequest<OrderView>(`/api/orders/${encodeURIComponent(orderId)}`, { token });
}

export function orderEventsUrl(orderId: string, token: string): string {
  return apiUrl(
    `/api/orders/${encodeURIComponent(orderId)}/events?token=${encodeURIComponent(token)}`,
  );
}

export function requestDevPayment(
  orderId: string,
  token: string,
  outcome: PaymentOutcome,
): Promise<ApiResult<{ orderId: string; outcome: PaymentOutcome }>> {
  return apiRequest(`/api/dev/orders/${encodeURIComponent(orderId)}/payment`, {
    method: "POST",
    token,
    body: { outcome },
  });
}
