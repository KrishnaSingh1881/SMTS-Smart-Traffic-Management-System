"use client";

/**
 * SSE Provider — connects to /api/monitoring/sse and dispatches
 * incoming events into the Zustand traffic store.
 * Requirements: 1.3, 1.4
 */

import { useEffect, useRef } from "react";
import { useTrafficStore } from "@/store/useTrafficStore";
import type { SSEEventType } from "@/lib/sse/emitter";

interface SSEMessage {
  type: SSEEventType;
  data: unknown;
}

export default function SSEProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    upsertSegment,
    markSegmentOffline,
    upsertSignal,
    upsertIncident,
    upsertPredictions,
    setAiDegraded,
    setSseConnected,
    setWeather,
    updateOptimizationScore,
    addXP,
  } = useTrafficStore();

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function connect() {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/monitoring/sse");
    esRef.current = es;

    es.onopen = () => {
      setSseConnected(true);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as SSEMessage;
        handleEvent(msg);
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      setSseConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 5 seconds
      retryRef.current = setTimeout(connect, 5000);
    };
  }

  function handleEvent(msg: SSEMessage) {
    switch (msg.type) {
      case "segment:update":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upsertSegment(msg.data as any);
        break;

      case "segment:offline":
        upsertSegment(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { ...(msg.data as any), sensorOnline: false }
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markSegmentOffline((msg.data as any).id);
        break;

      case "signal:update":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upsertSignal(msg.data as any);
        break;

      case "incident:new":
      case "incident:update":
      case "incident:escalated":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upsertIncident(msg.data as any);
        break;

      case "prediction:alert": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pred = msg.data as any;
        upsertPredictions(pred.segmentId, pred.predictions ?? [pred]);
        break;
      }

      case "system:ai-available":
        setAiDegraded(false);
        break;

      case "system:ai-unavailable":
        setAiDegraded(true);
        break;

      case "simulation:weather_change":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setWeather((msg.data as any).weather);
        break;

      case "simulation:score_update":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateOptimizationScore((msg.data as any).score - useTrafficStore.getState().simulation.optimizationScore);
        break;

      case "simulation:xp_gain":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addXP((msg.data as any).amount);
        break;

      default:
        break;
    }
  }

  useEffect(() => {
    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      esRef.current?.close();
      setSseConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
