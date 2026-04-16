/**
 * AI Signal Optimization Service
 * Requirements: 3.1, 3.2, 3.3, 3.5
 *
 * Orchestrates AI-driven signal timing optimization:
 * - Fetches current traffic conditions
 * - Calls Ollama AI for recommendations
 * - Validates and applies timing updates
 * - Records audit logs
 * - Emits SSE events
 */

import { prisma } from "@/lib/db/prisma";
import { ollamaGenerate } from "./ollama";
import { buildSignalOptimizationPrompt } from "./prompts";
import { parseSignalTimingResponse } from "./parser";
import { emitSSE } from "@/lib/sse/emitter";
import type { SegmentData, PhaseData } from "./prompts";
import { Prisma } from "@prisma/client";

/**
 * Optimize signal timing for a specific traffic signal using AI.
 * Skips signals with active manual overrides (Req 2.3).
 * Returns true if optimization was applied, false otherwise.
 */
export async function optimizeSignal(signalId: string): Promise<boolean> {
  try {
    // Fetch signal with current state
    const signal = await prisma.trafficSignal.findUnique({
      where: { id: signalId },
      include: {
        intersection: {
          include: {
            intersectionSegments: {
              include: {
                segment: true,
              },
            },
          },
        },
        signalPhases: {
          where: { isActive: true },
          orderBy: { sequenceOrder: "asc" },
        },
      },
    });

    if (!signal) {
      console.error(`[Optimizer] Signal ${signalId} not found`);
      return false;
    }

    // Skip signals with active manual override (Req 2.3)
    if (signal.overrideActive) {
      console.log(
        `[Optimizer] Skipping signal ${signalId} - manual override active`
      );
      return false;
    }

    // Gather traffic data from connected segments
    const segments: SegmentData[] = [];
    for (const is of signal.intersection.intersectionSegments) {
      // Get latest observation for this segment
      const latestObs = await prisma.trafficObservation.findFirst({
        where: { segmentId: is.segment.id },
        orderBy: { observedAt: "desc" },
      });

      segments.push({
        id: is.segment.id,
        name: is.segment.name,
        currentCongestion: is.segment.currentCongestion,
        vehicleCount: latestObs?.vehicleCount ?? 0,
        avgSpeedKmh: latestObs?.avgSpeedKmh.toNumber() ?? 0,
        speedLimitKmh: is.segment.speedLimitKmh,
      });
    }

    // Get current active phases
    const currentPhases: PhaseData[] = signal.signalPhases.map((p) => ({
      phaseState: p.phaseState,
      durationSeconds: p.durationSeconds,
      sequenceOrder: p.sequenceOrder,
    }));

    // Build prompt and call AI
    const prompt = buildSignalOptimizationPrompt(
      signalId,
      segments,
      currentPhases
    );
    const aiResponse = await ollamaGenerate(prompt);

    // Graceful degradation: if AI unavailable, retain current timing (Req 10.3)
    if (aiResponse === null) {
      console.log(
        `[Optimizer] AI unavailable for signal ${signalId} - retaining current timing`
      );
      return false;
    }

    // Parse and validate response
    const updates = parseSignalTimingResponse(aiResponse);

    if (updates.length === 0) {
      console.error(
        `[Optimizer] No valid timing updates parsed for signal ${signalId}`
      );
      return false;
    }

    // Store previous timing for audit log
    const previousTiming: Prisma.InputJsonArray = currentPhases.map((p) => ({
      phaseState: p.phaseState,
      sequenceOrder: p.sequenceOrder,
      durationSeconds: p.durationSeconds,
    }));
    const newTiming: Prisma.InputJsonArray = updates.map((update) => ({
      phaseState: update.phaseState,
      durationSeconds: update.durationSeconds,
      sequenceOrder: update.sequenceOrder,
      confidence: update.confidence,
    }));

    // Apply updates in a transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate current phases
      await tx.signalPhase.updateMany({
        where: {
          signalId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Create new phases with AI-optimized timing
      for (const update of updates) {
        await tx.signalPhase.create({
          data: {
            signalId,
            phaseState: update.phaseState,
            durationSeconds: update.durationSeconds,
            sequenceOrder: update.sequenceOrder,
            isActive: true,
            source: "ai_optimized",
            aiConfidenceScore: update.confidence,
            appliedAt: new Date(),
          },
        });
      }

      // Update signal metadata
      await tx.trafficSignal.update({
        where: { id: signalId },
        data: {
          aiOptimized: true,
          lastAiUpdateAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      });

      // Insert audit log (Req 3.3)
      // Note: For AI updates, we need a system user ID. In production, create a dedicated system user.
      // For now, we'll fetch the first Traffic_Controller user as a fallback.
      const systemUser = await tx.user.findFirst({
        where: { role: "Traffic_Controller" },
        select: { id: true },
      });

      if (systemUser) {
        const auditMetadata: Prisma.InputJsonObject = {
          previousTiming,
          newTiming,
          aiConfidenceScore: updates[0]?.confidence ?? 0,
          optimizedAt: new Date().toISOString(),
          source: "ai_system",
        };

        await tx.auditLog.create({
          data: {
            action: "SIGNAL_AI_UPDATE",
            userId: systemUser.id,
            signalId,
            metadata: auditMetadata,
          },
        });
      }
    });

    // Emit SSE event
    emitSSE("signal:update", {
      signalId,
      action: "ai_optimized",
      timestamp: new Date().toISOString(),
    });

    console.log(`[Optimizer] Successfully optimized signal ${signalId}`);
    return true;
  } catch (error) {
    console.error(`[Optimizer] Error optimizing signal ${signalId}:`, error);
    return false;
  }
}

/**
 * Schedule optimization loop for all signals.
 * Standard intersections: every 5 minutes (Req 3.2)
 * High-priority intersections: every 2 minutes (Req 3.5)
 */
export function startOptimizationScheduler(): void {
  // Standard intersections: every 5 minutes
  setInterval(async () => {
    try {
      const signals = await prisma.trafficSignal.findMany({
        where: {
          isOnline: true,
          intersection: {
            isHighPriority: false,
          },
        },
        select: { id: true },
      });

      console.log(
        `[Scheduler] Running optimization for ${signals.length} standard signals`
      );

      for (const signal of signals) {
        await optimizeSignal(signal.id);
      }
    } catch (error) {
      console.error("[Scheduler] Error in standard optimization loop:", error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // High-priority intersections: every 2 minutes
  setInterval(async () => {
    try {
      const signals = await prisma.trafficSignal.findMany({
        where: {
          isOnline: true,
          intersection: {
            isHighPriority: true,
          },
        },
        select: { id: true },
      });

      console.log(
        `[Scheduler] Running optimization for ${signals.length} high-priority signals`
      );

      for (const signal of signals) {
        await optimizeSignal(signal.id);
      }
    } catch (error) {
      console.error(
        "[Scheduler] Error in high-priority optimization loop:",
        error
      );
    }
  }, 2 * 60 * 1000); // 2 minutes

  console.log("[Scheduler] Signal optimization scheduler started");
}
