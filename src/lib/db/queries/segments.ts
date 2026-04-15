/**
 * Typed query wrappers for road segments
 * Requirements: 10.4
 */

import { prisma } from "@/lib/db/prisma";
import type { Segment } from "@/types";

/**
 * Get all road segments with current state
 */
export async function getAllSegments(): Promise<Segment[]> {
  const segments = await prisma.roadSegment.findMany({
    orderBy: { name: "asc" },
  });

  return segments.map((s) => ({
    id: s.id,
    name: s.name,
    geometry: s.geometry,
    lengthMeters: Number(s.lengthMeters),
    speedLimitKmh: s.speedLimitKmh,
    currentCongestion: s.currentCongestion,
    sensorOnline: s.sensorOnline,
    lastObservationAt: s.lastObservationAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));
}

/**
 * Get a single segment by ID
 */
export async function getSegmentById(id: string): Promise<Segment | null> {
  const segment = await prisma.roadSegment.findUnique({
    where: { id },
  });

  if (!segment) return null;

  return {
    id: segment.id,
    name: segment.name,
    geometry: segment.geometry,
    lengthMeters: Number(segment.lengthMeters),
    speedLimitKmh: segment.speedLimitKmh,
    currentCongestion: segment.currentCongestion,
    sensorOnline: segment.sensorOnline,
    lastObservationAt: segment.lastObservationAt?.toISOString() ?? null,
    createdAt: segment.createdAt.toISOString(),
  };
}

/**
 * Update segment sensor online status
 */
export async function updateSegmentSensorStatus(
  id: string,
  online: boolean
): Promise<void> {
  await prisma.roadSegment.update({
    where: { id },
    data: { sensorOnline: online },
  });
}
