/**
 * AI Congestion Prediction Service
 * Requirements: 5.1, 5.2, 5.4, 5.5
 *
 * Orchestrates AI-driven congestion prediction:
 * - Fetches last 60 min of traffic observations
 * - Calls Ollama AI for predictions
 * - Parses response into prediction data
 * - Stores predictions in database
 * - Emits SSE alerts for Heavy/Gridlock predictions
 */

import { prisma } from "@/lib/db/prisma";
import { ollamaGenerate } from "./ollama";
import { emitSSE } from "@/lib/sse/emitter";
import type { CongestionLevel } from "@prisma/client";

interface PredictionResult {
  level: CongestionLevel;
  confidence: number;
  window: 60 | 120;
}

/**
 * Build a prompt for congestion prediction based on historical traffic data.
 */
function buildCongestionPredictionPrompt(
  segmentId: string,
  segmentName: string,
  observations: Array<{
    vehicleCount: number;
    avgSpeedKmh: number;
    congestionLevel: CongestionLevel;
    observedAt: Date;
  }>
): string {
  const obsSummary = observations
    .map(
      (o) =>
        `- ${o.observedAt.toISOString()}: ${o.vehicleCount} vehicles, ${o.avgSpeedKmh} km/h, ${o.congestionLevel} congestion`
    )
    .join("\n");

  return `You are a traffic congestion prediction AI. Your task is to predict future congestion levels based on historical traffic observations.

Segment ID: ${segmentId}
Segment Name: ${segmentName}

Traffic Observations (last 60 minutes):
${obsSummary}

Instructions:
1. Analyze the traffic patterns over the last 60 minutes.
2. Predict the congestion level for TWO time windows:
   - 60 minutes from now
   - 120 minutes from now
3. Each prediction must include:
   - level: one of "Free", "Moderate", "Heavy", or "Gridlock"
   - confidence: a number between 0 and 1 indicating prediction confidence
   - window: either 60 or 120 (minutes)
4. Consider trends in vehicle count, speed, and current congestion level.
5. Return your response as a JSON array with this exact format:

[
  {
    "level": "Moderate",
    "confidence": 0.75,
    "window": 60
  },
  {
    "level": "Heavy",
    "confidence": 0.65,
    "window": 120
  }
]

Respond ONLY with the JSON array. Do not include any explanatory text before or after the JSON.`;
}

/**
 * Parse AI response for congestion predictions.
 * Returns an empty array if parsing fails or validation fails.
 */
function parseCongestionPredictionResponse(
  raw: string
): PredictionResult[] {
  try {
    // Extract JSON from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[Predictor] No JSON array found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.error("[Predictor] Response is not an array");
      return [];
    }

    const validLevels: CongestionLevel[] = ["Free", "Moderate", "Heavy", "Gridlock"];
    const validWindows = [60, 120];
    const predictions: PredictionResult[] = [];

    for (const item of parsed) {
      // Validate structure
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.level !== "string" ||
        typeof item.confidence !== "number" ||
        typeof item.window !== "number"
      ) {
        console.error("[Predictor] Invalid item structure:", item);
        continue;
      }

      // Validate congestion level
      if (!validLevels.includes(item.level as CongestionLevel)) {
        console.error("[Predictor] Invalid congestion level:", item.level);
        continue;
      }

      // Validate confidence score
      if (item.confidence < 0 || item.confidence > 1) {
        console.error("[Predictor] Confidence outside valid range:", item.confidence);
        continue;
      }

      // Validate window
      if (!validWindows.includes(item.window)) {
        console.error("[Predictor] Invalid window:", item.window);
        continue;
      }

      predictions.push({
        level: item.level as CongestionLevel,
        confidence: item.confidence,
        window: item.window as 60 | 120,
      });
    }

    return predictions;
  } catch (error) {
    console.error("[Predictor] Failed to parse response:", error);
    return [];
  }
}

/**
 * Predict congestion for a specific segment using AI.
 * Returns true if predictions were generated and stored, false otherwise.
 */
export async function predictCongestion(segmentId: string): Promise<boolean> {
  try {
    // Fetch segment
    const segment = await prisma.roadSegment.findUnique({
      where: { id: segmentId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!segment) {
      console.error(`[Predictor] Segment ${segmentId} not found`);
      return false;
    }

    // Fetch last 60 minutes of observations
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const observations = await prisma.trafficObservation.findMany({
      where: {
        segmentId,
        observedAt: {
          gte: sixtyMinutesAgo,
        },
      },
      orderBy: { observedAt: "desc" },
      select: {
        vehicleCount: true,
        avgSpeedKmh: true,
        congestionLevel: true,
        observedAt: true,
      },
    });

    if (observations.length === 0) {
      console.log(
        `[Predictor] No observations found for segment ${segmentId} in last 60 minutes`
      );
      return false;
    }

    // Build prompt and call AI
    const prompt = buildCongestionPredictionPrompt(
      segment.id,
      segment.name,
      observations.map((o) => ({
        vehicleCount: o.vehicleCount,
        avgSpeedKmh: o.avgSpeedKmh.toNumber(),
        congestionLevel: o.congestionLevel,
        observedAt: o.observedAt,
      }))
    );

    const aiResponse = await ollamaGenerate(prompt);

    // Graceful degradation: if AI unavailable, skip prediction
    if (aiResponse === null) {
      console.log(
        `[Predictor] AI unavailable for segment ${segmentId} - skipping prediction`
      );
      return false;
    }

    // Parse and validate response
    const predictions = parseCongestionPredictionResponse(aiResponse);

    if (predictions.length === 0) {
      console.error(
        `[Predictor] No valid predictions parsed for segment ${segmentId}`
      );
      return false;
    }

    // Store predictions in database
    const now = new Date();
    for (const pred of predictions) {
      await prisma.congestionPrediction.create({
        data: {
          segmentId,
          predictedLevel: pred.level,
          targetWindowMinutes: pred.window,
          modelConfidenceScore: pred.confidence,
          predictedAt: now,
        },
      });
    }

    // Emit SSE alert for Heavy/Gridlock predictions at 60-min window (Req 5.4)
    const sixtyMinPrediction = predictions.find((p) => p.window === 60);
    if (
      sixtyMinPrediction &&
      (sixtyMinPrediction.level === "Heavy" || sixtyMinPrediction.level === "Gridlock")
    ) {
      emitSSE("prediction:alert", {
        segmentId,
        segmentName: segment.name,
        predictedLevel: sixtyMinPrediction.level,
        confidence: sixtyMinPrediction.confidence,
        targetWindowMinutes: 60,
        timestamp: now.toISOString(),
      });
    }

    console.log(
      `[Predictor] Successfully generated predictions for segment ${segmentId}`
    );
    return true;
  } catch (error) {
    console.error(`[Predictor] Error predicting congestion for segment ${segmentId}:`, error);
    return false;
  }
}

/**
 * Schedule prediction loop for all segments.
 * Runs every 15 minutes per segment (Req 5.1).
 */
export function startPredictionScheduler(): void {
  setInterval(async () => {
    try {
      const segments = await prisma.roadSegment.findMany({
        where: {
          sensorOnline: true, // Only predict for segments with active sensors
        },
        select: { id: true, name: true },
      });

      console.log(
        `[Scheduler] Running predictions for ${segments.length} segments`
      );

      for (const segment of segments) {
        await predictCongestion(segment.id);
      }
    } catch (error) {
      console.error("[Scheduler] Error in prediction loop:", error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  console.log("[Scheduler] Congestion prediction scheduler started");
}
