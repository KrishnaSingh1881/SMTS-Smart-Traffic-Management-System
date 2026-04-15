/**
 * Typed query wrappers for congestion predictions
 * Requirements: 10.4
 */

import { prisma } from "@/lib/db/prisma";
import type { Prediction } from "@/types";

/**
 * Get latest predictions for all segments
 */
export async function getLatestPredictions(): Promise<Prediction[]> {
  // Get the most recent prediction for each segment
  const predictions = await prisma.congestionPrediction.findMany({
    orderBy: { predictedAt: "desc" },
    distinct: ["segmentId", "targetWindowMinutes"],
  });

  return predictions.map((p) => ({
    id: p.id,
    segmentId: p.segmentId,
    predictedLevel: p.predictedLevel,
    targetWindowMinutes: p.targetWindowMinutes as 60 | 120,
    modelConfidenceScore: Number(p.modelConfidenceScore),
    predictedAt: p.predictedAt.toISOString(),
  }));
}

/**
 * Get predictions for a specific segment
 */
export async function getPredictionsBySegment(
  segmentId: string
): Promise<Prediction[]> {
  const predictions = await prisma.congestionPrediction.findMany({
    where: { segmentId },
    orderBy: { predictedAt: "desc" },
    take: 10, // Last 10 predictions
  });

  return predictions.map((p) => ({
    id: p.id,
    segmentId: p.segmentId,
    predictedLevel: p.predictedLevel,
    targetWindowMinutes: p.targetWindowMinutes as 60 | 120,
    modelConfidenceScore: Number(p.modelConfidenceScore),
    predictedAt: p.predictedAt.toISOString(),
  }));
}

/**
 * Get recent predictions (within last 15 minutes)
 */
export async function getRecentPredictions(): Promise<Prediction[]> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const predictions = await prisma.congestionPrediction.findMany({
    where: {
      predictedAt: {
        gte: fifteenMinutesAgo,
      },
    },
    orderBy: { predictedAt: "desc" },
  });

  return predictions.map((p) => ({
    id: p.id,
    segmentId: p.segmentId,
    predictedLevel: p.predictedLevel,
    targetWindowMinutes: p.targetWindowMinutes as 60 | 120,
    modelConfidenceScore: Number(p.modelConfidenceScore),
    predictedAt: p.predictedAt.toISOString(),
  }));
}
