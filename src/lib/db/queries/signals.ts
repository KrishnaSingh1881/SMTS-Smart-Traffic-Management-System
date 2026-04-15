/**
 * Typed query wrappers for traffic signals
 * Requirements: 10.4
 */

import { prisma } from "@/lib/db/prisma";
import type { Signal } from "@/types";

/**
 * Get all traffic signals with current state
 */
export async function getAllSignals(): Promise<Signal[]> {
  const signals = await prisma.trafficSignal.findMany({
    orderBy: { label: "asc" },
  });

  return signals.map((s) => ({
    id: s.id,
    intersectionId: s.intersectionId,
    label: s.label,
    currentPhase: s.currentPhase,
    isOnline: s.isOnline,
    overrideActive: s.overrideActive,
    overrideExpiresAt: s.overrideExpiresAt?.toISOString() ?? null,
    overrideByUserId: s.overrideByUserId,
    aiOptimized: s.aiOptimized,
    lastAiUpdateAt: s.lastAiUpdateAt?.toISOString() ?? null,
    lastUpdatedAt: s.lastUpdatedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));
}

/**
 * Get a single signal by ID
 */
export async function getSignalById(id: string): Promise<Signal | null> {
  const signal = await prisma.trafficSignal.findUnique({
    where: { id },
  });

  if (!signal) return null;

  return {
    id: signal.id,
    intersectionId: signal.intersectionId,
    label: signal.label,
    currentPhase: signal.currentPhase,
    isOnline: signal.isOnline,
    overrideActive: signal.overrideActive,
    overrideExpiresAt: signal.overrideExpiresAt?.toISOString() ?? null,
    overrideByUserId: signal.overrideByUserId,
    aiOptimized: signal.aiOptimized,
    lastAiUpdateAt: signal.lastAiUpdateAt?.toISOString() ?? null,
    lastUpdatedAt: signal.lastUpdatedAt.toISOString(),
    createdAt: signal.createdAt.toISOString(),
  };
}

/**
 * Get all signals for a specific intersection
 */
export async function getSignalsByIntersection(
  intersectionId: string
): Promise<Signal[]> {
  const signals = await prisma.trafficSignal.findMany({
    where: { intersectionId },
    orderBy: { label: "asc" },
  });

  return signals.map((s) => ({
    id: s.id,
    intersectionId: s.intersectionId,
    label: s.label,
    currentPhase: s.currentPhase,
    isOnline: s.isOnline,
    overrideActive: s.overrideActive,
    overrideExpiresAt: s.overrideExpiresAt?.toISOString() ?? null,
    overrideByUserId: s.overrideByUserId,
    aiOptimized: s.aiOptimized,
    lastAiUpdateAt: s.lastAiUpdateAt?.toISOString() ?? null,
    lastUpdatedAt: s.lastUpdatedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));
}
