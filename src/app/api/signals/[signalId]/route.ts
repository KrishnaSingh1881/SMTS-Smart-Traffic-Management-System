/**
 * GET /api/signals/[signalId]
 * PATCH /api/signals/[signalId]
 * Get single signal detail or update current phase.
 * Requirements: 2.1, 2.2, 8.4
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";
import type { SignalPhaseState } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: { signalId: string } }
) {
  try {
    const signal = await prisma.trafficSignal.findUnique({
      where: { id: params.signalId },
      include: {
        intersection: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        signalPhases: {
          orderBy: {
            appliedAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    return NextResponse.json(signal, { status: 200 });
  } catch (error) {
    console.error("Error fetching signal:", error);
    return NextResponse.json(
      { error: "Failed to fetch signal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { signalId: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { current_phase } = body as Record<string, unknown>;

  // Validate current_phase
  const validPhases: SignalPhaseState[] = ["Green", "Yellow", "Red", "Off"];
  if (
    typeof current_phase !== "string" ||
    !validPhases.includes(current_phase as SignalPhaseState)
  ) {
    return NextResponse.json(
      {
        error: `Invalid current_phase. Must be one of: ${validPhases.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const signal = await prisma.trafficSignal.update({
      where: { id: params.signalId },
      data: {
        currentPhase: current_phase as SignalPhaseState,
        lastUpdatedAt: new Date(),
      },
      include: {
        intersection: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Emit SSE event
    emitSSE("signal:update", {
      signalId: signal.id,
      currentPhase: signal.currentPhase,
      overrideActive: signal.overrideActive,
      lastUpdatedAt: signal.lastUpdatedAt.toISOString(),
    });

    return NextResponse.json(signal, { status: 200 });
  } catch (error) {
    console.error("Error updating signal:", error);
    return NextResponse.json(
      { error: "Failed to update signal" },
      { status: 500 }
    );
  }
}
