/**
 * GET /api/monitoring/sse
 * Server-Sent Events stream for real-time traffic updates.
 * Requirements: 7.2
 */

import { sseEmitter } from "@/lib/sse/emitter";
import { startSensorWatchdog } from "@/lib/utils/sensorWatchdog";
import { startOptimizationScheduler } from "@/lib/ai/signalOptimizer";
import { startIncidentEscalator } from "@/lib/utils/incidentEscalator";
import { startPredictionScheduler } from "@/lib/ai/congestionPredictor";
import type { SSEEvent } from "@/lib/sse/emitter";

let watchdogStarted = false;
let optimizerStarted = false;
let escalatorStarted = false;
let predictorStarted = false;

export async function GET(request: Request) {
  // Start sensor watchdog on first SSE connection
  if (!watchdogStarted) {
    watchdogStarted = true;
    startSensorWatchdog();
  }

  // Start AI optimization scheduler on first SSE connection (Req 3.2, 3.5)
  if (!optimizerStarted) {
    optimizerStarted = true;
    startOptimizationScheduler();
  }

  // Start incident escalation scheduler on first SSE connection (Req 4.6)
  if (!escalatorStarted) {
    escalatorStarted = true;
    startIncidentEscalator();
  }

  // Start congestion prediction scheduler on first SSE connection (Req 5.1, 5.2)
  if (!predictorStarted) {
    predictorStarted = true;
    startPredictionScheduler();
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const listener = (event: SSEEvent) => {
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
