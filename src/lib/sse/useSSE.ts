"use client";

/**
 * useSSE — Custom React hook wrapping EventSource with exponential backoff reconnection.
 *
 * Reconnection schedule: 1s → 2s → 4s (max 3 retries by default).
 * After all retries are exhausted, surfaces a "Connection lost" toast with a
 * manual "Reconnect" button via the returned `toast` state.
 *
 * Requirements: 21.4, 21.5
 *
 * Usage:
 *   const { reconnect, toast, dismissToast } = useSSE({
 *     url: '/api/monitoring/sse',
 *     onMessage: (event) => { ... },
 *   });
 *
 * To replace raw EventSource usage, swap:
 *   const es = new EventSource(url);
 *   es.onmessage = handler;
 *   es.onerror = errorHandler;
 *   // cleanup: es.close();
 *
 * With:
 *   const { reconnect, toast, dismissToast } = useSSE({ url, onMessage: handler });
 *   // Render <ToastNotification> when toast is non-null
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { ToastItem } from "@/hooks/useToast";
import type { ToastAction } from "@/components/ui/ToastNotification";

export interface UseSSEOptions {
  /** The SSE endpoint URL */
  url: string;
  /** Called for every incoming MessageEvent */
  onMessage: (event: MessageEvent) => void;
  /** Optional error callback (called on each error before retry logic) */
  onError?: (error: Event) => void;
  /** Maximum number of reconnection attempts (default: 3) */
  maxRetries?: number;
}

export interface UseSSEResult {
  /** Manually trigger a reconnection attempt and reset the retry counter */
  reconnect: () => void;
  /** Non-null when a "Connection lost" toast should be displayed */
  toast: ToastItem | null;
  /** Dismiss the current toast */
  dismissToast: () => void;
}

const BASE_DELAY_MS = 1000; // 1s, 2s, 4s for retries 0, 1, 2

export function useSSE({
  url,
  onMessage,
  onError,
  maxRetries = 3,
}: UseSSEOptions): UseSSEResult {
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Stable refs so effect callbacks don't need to re-run when handlers change
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const [toast, setToast] = useState<ToastItem | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const closeES = useCallback(() => {
    if (esRef.current) {
      esRef.current.onmessage = null;
      esRef.current.onerror = null;
      esRef.current.onopen = null;
      esRef.current.close();
      esRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Forward-declared so reconnect can reference connect and vice-versa
  const connectRef = useRef<() => void>(() => {});

  const reconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    closeES();
    retryCountRef.current = 0;
    setToast(null);
    connectRef.current();
  }, [closeES]);

  useEffect(() => {
    isMountedRef.current = true;

    const connect = () => {
      if (!isMountedRef.current) return;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        // Successful connection — reset retry counter and clear any error toast
        retryCountRef.current = 0;
        if (isMountedRef.current) {
          setToast(null);
        }
      };

      es.onmessage = (event: MessageEvent) => {
        onMessageRef.current(event);
      };

      es.onerror = (error: Event) => {
        onErrorRef.current?.(error);

        if (!isMountedRef.current) return;

        // Close the broken connection before retrying
        closeES();

        if (retryCountRef.current < maxRetries) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;

          retryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delayMs);
        } else {
          // All retries exhausted — show "Connection lost" toast
          const action: ToastAction = {
            label: "Reconnect",
            onClick: reconnect,
          };
          setToast({
            id: crypto.randomUUID(),
            message: "Connection lost",
            type: "error",
            action,
          });
        }
      };
    };

    // Store connect in ref so reconnect() can call it
    connectRef.current = connect;

    connect();

    return () => {
      isMountedRef.current = false;
      closeES();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, maxRetries]);

  return { reconnect, toast, dismissToast };
}
