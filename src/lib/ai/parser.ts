/**
 * AI response parser for signal timing updates
 * Requirements: 3.1, 3.3
 *
 * Parses and validates AI-generated signal timing recommendations.
 */

import type { SignalPhaseState } from "@prisma/client";

export interface SignalTimingUpdate {
  phaseState: SignalPhaseState;
  sequenceOrder: number;
  durationSeconds: number;
  confidence: number;
}

const VALID_PHASE_STATES: SignalPhaseState[] = ["Green", "Yellow", "Red", "Off"];
const MIN_DURATION = 10;
const MAX_DURATION = 180;
const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 1;

/**
 * Parse and validate AI response for signal timing updates.
 * Returns an empty array if parsing fails or validation fails.
 */
export function parseSignalTimingResponse(
  raw: string
): SignalTimingUpdate[] {
  try {
    // Extract JSON from response (AI might include extra text)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[Parser] No JSON array found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.error("[Parser] Response is not an array");
      return [];
    }

    const updates: SignalTimingUpdate[] = [];

    for (const item of parsed) {
      // Validate structure
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.phaseState !== "string" ||
        typeof item.sequenceOrder !== "number" ||
        typeof item.durationSeconds !== "number" ||
        typeof item.confidence !== "number"
      ) {
        console.error("[Parser] Invalid item structure:", item);
        continue;
      }

      // Validate phase state
      if (!VALID_PHASE_STATES.includes(item.phaseState as SignalPhaseState)) {
        console.error("[Parser] Invalid phase state:", item.phaseState);
        continue;
      }

      // Validate duration (Req 3.3: 10-180 seconds)
      if (
        item.durationSeconds < MIN_DURATION ||
        item.durationSeconds > MAX_DURATION
      ) {
        console.error(
          `[Parser] Duration ${item.durationSeconds}s outside valid range [${MIN_DURATION}, ${MAX_DURATION}]`
        );
        continue;
      }

      // Validate confidence score
      if (
        item.confidence < MIN_CONFIDENCE ||
        item.confidence > MAX_CONFIDENCE
      ) {
        console.error(
          `[Parser] Confidence ${item.confidence} outside valid range [${MIN_CONFIDENCE}, ${MAX_CONFIDENCE}]`
        );
        continue;
      }

      // Validate sequence order
      if (item.sequenceOrder < 0 || !Number.isInteger(item.sequenceOrder)) {
        console.error("[Parser] Invalid sequence order:", item.sequenceOrder);
        continue;
      }

      updates.push({
        phaseState: item.phaseState as SignalPhaseState,
        sequenceOrder: item.sequenceOrder,
        durationSeconds: Math.round(item.durationSeconds),
        confidence: item.confidence,
      });
    }

    return updates;
  } catch (error) {
    console.error("[Parser] Failed to parse response:", error);
    return [];
  }
}
