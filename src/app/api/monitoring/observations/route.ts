/**
 * POST /api/monitoring/observations
 * Ingest a traffic observation for a road segment.
 * Requirements: 7.1
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";
import { computeCongestionLevel } from "@/lib/utils/congestion";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { segment_id, vehicle_count, avg_speed_kmh } = body as Record<string, unknown>;

  // Validate required fields
  if (
    typeof segment_id !== "string" ||
    segment_id.trim() === "" ||
    typeof vehicle_count !== "number" ||
    vehicle_count < 0 ||
    typeof avg_speed_kmh !== "number" ||
    avg_speed_kmh < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields. Required: segment_id (string), vehicle_count (number ≥ 0), avg_speed_kmh (number ≥ 0)",
      },
      { status: 400 }
    );
  }

  const congestionLevel = computeCongestionLevel(vehicle_count, avg_speed_kmh);
  const now = new Date();

  const [observation] = await prisma.$transaction([
    prisma.trafficObservation.create({
      data: {
        segmentId: segment_id,
        vehicleCount: vehicle_count,
        avgSpeedKmh: avg_speed_kmh,
        congestionLevel,
        observedAt: now,
      },
    }),
    prisma.roadSegment.update({
      where: { id: segment_id },
      data: {
        lastObservationAt: now,
        sensorOnline: true,
        currentCongestion: congestionLevel,
      },
    }),
  ]);

  emitSSE("segment:update", {
    segmentId: segment_id,
    vehicleCount: vehicle_count,
    avgSpeedKmh: avg_speed_kmh,
    congestionLevel,
    lastObservationAt: now.toISOString(),
  });

  return NextResponse.json(observation, { status: 201 });
}
