/**
 * Sensor offline watchdog
 * Requirements: 7.3
 *
 * Periodically marks road segments as offline when no observation
 * has been received within the last 120 seconds.
 */

import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";

let watchdogStarted = false;

/**
 * Start the sensor watchdog. Idempotent — only starts once per process.
 * Runs every 30 seconds, marking segments offline if their last observation
 * is older than 120 seconds (or null) and they are currently marked online.
 */
export function startSensorWatchdog(): void {
  if (watchdogStarted) return;
  watchdogStarted = true;

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 120_000);

      const staleSegments = await prisma.roadSegment.findMany({
        where: {
          sensorOnline: true,
          OR: [
            { lastObservationAt: { lt: cutoff } },
            { lastObservationAt: null },
          ],
        },
        select: { id: true, name: true },
      });

      for (const segment of staleSegments) {
        await prisma.roadSegment.update({
          where: { id: segment.id },
          data: { sensorOnline: false },
        });

        emitSSE("segment:offline", {
          segmentId: segment.id,
          name: segment.name,
        });
      }
    } catch (err) {
      console.error("[sensorWatchdog] error:", err);
    }
  }, 30_000);
}
