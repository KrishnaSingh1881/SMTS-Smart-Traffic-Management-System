/**
 * AI prompt templates for signal optimization
 * Requirements: 3.1
 *
 * Builds structured prompts for the Ollama AI engine to generate
 * optimized signal timing recommendations.
 */

import type { CongestionLevel, SignalPhaseState } from "@prisma/client";

export interface SegmentData {
  id: string;
  name: string;
  currentCongestion: CongestionLevel;
  vehicleCount: number;
  avgSpeedKmh: number;
  speedLimitKmh: number;
}

export interface PhaseData {
  phaseState: SignalPhaseState;
  durationSeconds: number;
  sequenceOrder: number;
}

/**
 * Build a prompt for signal optimization based on current traffic conditions.
 * The prompt instructs the AI to return JSON with phase timings.
 */
export function buildSignalOptimizationPrompt(
  signalId: string,
  segments: SegmentData[],
  currentPhases: PhaseData[]
): string {
  const segmentSummary = segments
    .map(
      (s) =>
        `- ${s.name}: ${s.currentCongestion} congestion, ${s.vehicleCount} vehicles, ${s.avgSpeedKmh} km/h (limit: ${s.speedLimitKmh} km/h)`
    )
    .join("\n");

  const currentPhaseSummary = currentPhases
    .map(
      (p) =>
        `- Phase ${p.sequenceOrder}: ${p.phaseState} for ${p.durationSeconds}s`
    )
    .join("\n");

  return `You are a traffic signal optimization AI. Your task is to recommend optimal signal phase durations based on current traffic conditions.

Signal ID: ${signalId}

Current Traffic Conditions:
${segmentSummary}

Current Signal Phases:
${currentPhaseSummary}

Instructions:
1. Analyze the traffic conditions on all road segments connected to this intersection.
2. Recommend optimized phase durations (in seconds) for each signal phase.
3. Each phase duration MUST be between 10 and 180 seconds (inclusive).
4. Prioritize phases for directions with higher congestion and vehicle counts.
5. Return your response as a JSON array with this exact format:

[
  {
    "phaseState": "Green",
    "sequenceOrder": 0,
    "durationSeconds": 45,
    "confidence": 0.85
  },
  {
    "phaseState": "Yellow",
    "sequenceOrder": 1,
    "durationSeconds": 5,
    "confidence": 0.90
  }
]

Respond ONLY with the JSON array. Do not include any explanatory text before or after the JSON.`;
}
