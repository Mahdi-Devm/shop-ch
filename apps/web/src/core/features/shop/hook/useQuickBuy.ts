"use client";

import type { ApiFailure } from "@/core/lib/api/api-client";
import { NETWORK_ERROR_STATUS } from "@/core/lib/api/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { submitOrder } from "../lib/shop-api";
import { createIdempotencyKey } from "../utils/idempotency-key";

const DEFAULT_RETRY_AFTER_SECONDS = 1;

export type QuickBuyState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "redirecting"; orderId: string; alreadyPlaced: boolean }
  | { kind: "soldOut" }
  | { kind: "rateLimited"; retryAfterSeconds: number }
  | { kind: "networkError" }
  | { kind: "invalid" }
  | { kind: "unauthorized" };

type QuickBuyOptions = {
  productId: string;
  token: string | null;
  onOrderPlaced: (orderId: string) => void;
  onSoldOut: () => void;
};

function stateForFailure(failure: ApiFailure): QuickBuyState {
  if (failure.status === 409 && failure.error.code === "DUPLICATE_IDEMPOTENCY_KEY" && failure.error.orderId) {
    return { kind: "redirecting", orderId: failure.error.orderId, alreadyPlaced: true };
  }
  if (failure.status === 409 && failure.error.code === "SOLD_OUT") {
    return { kind: "soldOut" };
  }
  if (failure.status === 429) {
    return {
      kind: "rateLimited",
      retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
    };
  }
  if (failure.status === 401) {
    return { kind: "unauthorized" };
  }
  if (failure.status === 400) {
    return { kind: "invalid" };
  }
  return { kind: "networkError" };
}

function outcomeIsKnown(failure: ApiFailure): boolean {
  return failure.status !== NETWORK_ERROR_STATUS && failure.status < 500 && failure.status !== 429;
}

export function useQuickBuy({ productId, token, onOrderPlaced, onSoldOut }: QuickBuyOptions) {
  const [state, setState] = useState<QuickBuyState>({ kind: "idle" });
  const purchaseIntentKey = useRef<string | null>(null);
  const isInFlight = useRef(false);

  useEffect(() => {
    if (state.kind !== "rateLimited") {
      return;
    }
    const timer = setTimeout(
      () => setState({ kind: "idle" }),
      state.retryAfterSeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [state]);

  const buy = useCallback(async () => {
    if (!token || isInFlight.current) {
      return;
    }
    isInFlight.current = true;
    purchaseIntentKey.current ??= createIdempotencyKey();
    setState({ kind: "submitting" });

    const result = await submitOrder(productId, token, purchaseIntentKey.current);
    isInFlight.current = false;

    if (result.ok) {
      purchaseIntentKey.current = null;
      setState({ kind: "redirecting", orderId: result.data.orderId, alreadyPlaced: false });
      onOrderPlaced(result.data.orderId);
      return;
    }

    const nextState = stateForFailure(result);
    if (outcomeIsKnown(result)) {
      purchaseIntentKey.current = null;
    }
    setState(nextState);

    if (nextState.kind === "redirecting") {
      onOrderPlaced(nextState.orderId);
    } else if (nextState.kind === "soldOut") {
      onSoldOut();
    }
  }, [productId, token, onOrderPlaced, onSoldOut]);

  const isDisabled =
    state.kind === "submitting" ||
    state.kind === "redirecting" ||
    state.kind === "soldOut" ||
    state.kind === "rateLimited";

  return { state, buy, isDisabled };
}
