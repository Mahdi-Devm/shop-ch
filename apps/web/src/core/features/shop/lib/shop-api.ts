import { apiRequest, type ApiResult } from "@/core/lib/api/api-client";
import type { OrderCreated, ProductStock } from "../assets/@types/shop.types";

export function fetchProductStock(
  productId: string,
  token: string,
  signal?: AbortSignal,
): Promise<ApiResult<ProductStock>> {
  return apiRequest<ProductStock>(`/api/products/${productId}`, {
    token,
    signal,
  });
}

export function submitOrder(
  productId: string,
  token: string,
  idempotencyKey: string,
): Promise<ApiResult<OrderCreated>> {
  return apiRequest<OrderCreated>("/api/orders", {
    method: "POST",
    token,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { productId, quantity: 1 },
  });
}
