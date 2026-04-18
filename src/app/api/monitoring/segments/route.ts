/**
 * GET /api/monitoring/segments
 * Returns all road segments with current state and latest observation data.
 * Auto-seeds Meridian City data if the DB is empty.
 * Requirements: 7.2
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seedMeridianCity } from "@/lib/seed/meridianCity";

let seedAttempted = false;

export async function GET() {
  // Auto-seed if DB has no segments (first run)
  if (!seedAttempted) {
    seedAttempted = true;
    const count = await prisma.roadSegment.count();
    if (count === 0) {
      try {
        await seedMeridianCity();
      } catch (err) {
        console.error("[segments] auto-seed failed:", err);
      }
    }
  }

  const segments = await prisma.roadSegment.findMany({
    select: {
      id: true,
      name: true,
      geometry: true,
      zoneType: true,
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
      geometry: seg.geometry,
      zoneType: seg.zoneType,
      currentCongestion: seg.currentCongestion,
      sensorOnline: seg.sensorOnline,
      lastObservationAt: seg.lastObservationAt?.toISOString() ?? null,
      vehicleCount: latest ? latest.vehicleCount : undefined,
      avgSpeedKmh: latest ? Number(latest.avgSpeedKmh) : undefined,
    };
  });

  return NextResponse.json(result, { status: 200 });
}
