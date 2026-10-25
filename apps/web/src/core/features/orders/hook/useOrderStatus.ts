"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderView } from "../assets/@types/orders.types";
import { fetchOrder, orderEventsUrl } from "../lib/orders-api";
import { isTerminalStatus, parseStatusEvent } from "../utils/order-status";

const REOPEN_DELAY_MS = 2000;

export type StreamConnection = "connecting" | "live" | "reconnecting" | "closed";

export type OrderStatusState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | { kind: "tracking"; order: OrderView; connection: StreamConnection };

export function useOrderStatus(orderId: string, token: string | null) {
  const [state, setState] = useState<OrderStatusState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let disposed = false;
    let source: EventSource | null = null;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let hasOpenedBefore = false;
    let current: OrderView | null = null;
    let connection: StreamConnection = "connecting";

    const publish = () => {
      if (!disposed && current) {
        setState({ kind: "tracking", order: current, connection });
      }
    };

    const closeStream = () => {
      clearTimeout(reopenTimer);
      source?.close();
      source = null;
    };

    const closeIfTerminal = () => {
      if (current && isTerminalStatus(current.status)) {
        closeStream();
        connection = "closed";
      }
    };

    const load = async (): Promise<boolean> => {
      const result = await fetchOrder(orderId, token);
      if (disposed) {
        return false;
      }
      if (!result.ok) {
        if (result.status === 401) {
          setState({ kind: "unauthorized" });
        } else if (result.status === 404 || result.status === 400) {
          setState({ kind: "notFound" });
        } else if (!current) {
          setState({ kind: "error" });
        }
        return false;
      }
      if (!current || result.data.version >= current.version) {
        current = result.data;
      }
      closeIfTerminal();
      publish();
      return true;
    };

    const open = () => {
      if (disposed || !current || isTerminalStatus(current.status)) {
        return;
      }
      const stream = new EventSource(orderEventsUrl(orderId, token));
      source = stream;

      stream.onopen = () => {
        connection = "live";
        if (hasOpenedBefore) {
          load().catch(() => undefined);
        }
        hasOpenedBefore = true;
        publish();
      };

      stream.onmessage = (message: MessageEvent<string>) => {
        const event = parseStatusEvent(message.data);
        if (!event || !current || event.version <= current.version) {
          return;
        }
        current = { ...current, status: event.status, version: event.version };
        closeIfTerminal();
        publish();
      };

      stream.onerror = () => {
        if (disposed || source !== stream) {
          return;
        }
        connection = "reconnecting";
        publish();
        if (stream.readyState === EventSource.CLOSED) {
          closeStream();
          reopenTimer = setTimeout(() => {
            load()
              .then((loaded) => {
                if (loaded) {
                  open();
                }
              })
              .catch(() => undefined);
          }, REOPEN_DELAY_MS);
        }
      };
    };

    load()
      .then((loaded) => {
        if (loaded) {
          open();
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      closeStream();
    };
  }, [orderId, token, attempt]);

  return { state, retry };
}
