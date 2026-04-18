/**
 * GET /api/ai/insight/stream
 * Server-Sent Events stream for AI insight updates.
 * Requirements: 13.5
 */

import { sseEmitter } from "@/lib/sse/emitter";
import type { SSEEvent } from "@/lib/sse/emitter";

const AI_EVENTS = new Set([
  "ai:token",
  "ai:insight_complete",
  "ai:insight_error",
]);

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const listener = (event: SSEEvent) => {
        if (!AI_EVENTS.has(event.type)) return;
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
