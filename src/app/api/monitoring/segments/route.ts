/**
 * GET /api/monitoring/segments
 * Returns all road segments with current state and latest observation data.
 * Requirements: 7.2
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const segments = await prisma.roadSegment.findMany({
    select: {
      id: true,
      name: true,
      currentCongestion: true,
      sensorOnline: true,
      lastObservationAt: true,
      trafficObservations: {
        orderBy: { observedAt: "desc" },
        take: 1,
        select: {
          vehicleCount: true,
          avgSpeedKmh: true,
        },
      },
    },
  });

  const result = segments.map((seg) => {
    const latest = seg.trafficObservations[0] ?? null;
    return {
      id: seg.id,
      name: seg.name,
      currentCongestion: seg.currentCongestion,
      sensorOnline: seg.sensorOnline,
      lastObservationAt: seg.lastObservationAt?.toISOString() ?? null,
      vehicleCount: latest ? latest.vehicleCount : undefined,
      avgSpeedKmh: latest ? Number(latest.avgSpeedKmh) : undefined,
    };
  });

  return NextResponse.json(result, { status: 200 });
}
