"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductStock } from "../assets/@types/shop.types";
import { fetchProductStock } from "../lib/shop-api";

const REFRESH_INTERVAL_MS = 3000;

export type ProductStockState =
  | { kind: "loading" }
  | { kind: "ready"; product: ProductStock }
  | { kind: "unavailable"; lastKnown: ProductStock | null }
  | { kind: "notFound" }
  | { kind: "unauthorized" };

export function useProductStock(productId: string, token: string | null) {
  const [state, setState] = useState<ProductStockState>({ kind: "loading" });
  const lastKnown = useRef<ProductStock | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        return;
      }
      const result = await fetchProductStock(productId, token, signal);
      if (result.ok) {
        lastKnown.current = result.data;
        setState({ kind: "ready", product: result.data });
      } else if (result.status === 401) {
        setState({ kind: "unauthorized" });
      } else if (result.status === 404) {
        setState({ kind: "notFound" });
      } else {
        setState({ kind: "unavailable", lastKnown: lastKnown.current });
      }
    },
    [productId, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      if (document.visibilityState === "visible") {
        refresh(controller.signal).catch(() => undefined);
      }
    };

    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [refresh]);

  return { state, refresh };
}
