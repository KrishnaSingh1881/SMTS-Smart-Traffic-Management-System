/**
 * GET /api/simulation/stream
 * Server-Sent Events stream for simulation updates.
 * Requirements: 6.9
 */

import { sseEmitter } from "@/lib/sse/emitter";
import type { SSEEvent } from "@/lib/sse/emitter";

const SIMULATION_EVENTS = new Set([
  "simulation:tick",
  "simulation:state_change",
  "simulation:scenario_update",
  "simulation:emergency_update",
  "simulation:signal_preemption",
]);

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const listener = (event: SSEEvent) => {
        if (!SIMULATION_EVENTS.has(event.type)) return;
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      sseEmitter.on("sse", listener);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        sseEmitter.off("sse", listener);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
