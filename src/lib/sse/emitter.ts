/**
 * SSE Event Emitter singleton
 * Requirements: 1.3, 1.4
 *
 * A Node.js EventEmitter singleton shared across all API route handlers.
 * API routes emit events here; the SSE stream route listens and forwards
 * them to connected clients as text/event-stream.
 */

import { EventEmitter } from "events";

// SSE event type definitions
export type SSEEventType =
  | "segment:update"
  | "segment:offline"
  | "signal:update"
  | "incident:new"
  | "incident:update"
  | "incident:escalated"
  | "prediction:alert"
  | "system:ai-unavailable";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

// Singleton pattern — safe for Next.js hot-reload in development
declare global {
  // eslint-disable-next-line no-var
  var __sseEmitter: EventEmitter | undefined;
}

function createEmitter(): EventEmitter {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200); // support many concurrent SSE clients
  return emitter;
}

export const sseEmitter: EventEmitter =
  globalThis.__sseEmitter ?? createEmitter();

if (process.env.NODE_ENV !== "production") {
  globalThis.__sseEmitter = sseEmitter;
}

/**
 * Emit a typed SSE event to all connected clients.
 */
export function emitSSE(type: SSEEventType, data: unknown): void {
  sseEmitter.emit("sse", { type, data } satisfies SSEEvent);
}
