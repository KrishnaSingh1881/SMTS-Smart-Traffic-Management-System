/**
 * POST /api/signals/[signalId]/override
 * DELETE /api/signals/[signalId]/override
 * Apply or cancel manual signal override.
 * Requirements: 2.2, 2.3, 2.4, 2.5, 8.4
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";
import { authOptions } from "@/lib/auth/options";
import type { SignalPhaseState } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: { signalId: string } }
) {
  // Get authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { phase, duration_seconds } = body as Record<string, unknown>;

  // Validate phase
  const validPhases: SignalPhaseState[] = ["Green", "Yellow", "Red", "Off"];
  if (
    typeof phase !== "string" ||
    !validPhases.includes(phase as SignalPhaseState)
  ) {
    return NextResponse.json(
      {
        error: `Invalid phase. Must be one of: ${validPhases.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate duration: 10–180 seconds (Req 2.5)
  if (
    typeof duration_seconds !== "number" ||
    duration_seconds < 10 ||
    duration_seconds > 180
  ) {
    return NextResponse.json(
      {
        error: "Invalid duration_seconds. Must be between 10 and 180 seconds.",
      },
      { status: 400 }
    );
  }

  try {
    const overrideExpiresAt = new Date(Date.now() + duration_seconds * 1000);

    // Update signal and insert audit log in transaction
    const [signal] = await prisma.$transaction([
      prisma.trafficSignal.update({
        where: { id: params.signalId },
        data: {
          currentPhase: phase as SignalPhaseState,
          overrideActive: true,
          overrideExpiresAt,
          overrideByUserId: userId,
          aiOptimized: false,
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
      }),
      prisma.auditLog.create({
        data: {
          action: "SIGNAL_OVERRIDE_APPLY",
          userId,
          signalId: params.signalId,
          metadata: {
            phase,
            durationSeconds: duration_seconds,
            expiresAt: overrideExpiresAt.toISOString(),
          },
        },
      }),
    ]);

    // Emit SSE event (Req 2.2)
    emitSSE("signal:update", {
      signalId: signal.id,
      currentPhase: signal.currentPhase,
      overrideActive: signal.overrideActive,
      overrideExpiresAt: signal.overrideExpiresAt?.toISOString(),
      lastUpdatedAt: signal.lastUpdatedAt.toISOString(),
    });

    return NextResponse.json(signal, { status: 200 });
  } catch (error) {
    console.error("Error applying override:", error);
    return NextResponse.json(
      { error: "Failed to apply override" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { signalId: string } }
) {
  // Get authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    // Cancel override and insert audit log in transaction (Req 2.4)
    const [signal] = await prisma.$transaction([
      prisma.trafficSignal.update({
        where: { id: params.signalId },
        data: {
          overrideActive: false,
          overrideExpiresAt: null,
          overrideByUserId: null,
          aiOptimized: true, // Resume AI optimization (Req 2.4)
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
      }),
      prisma.auditLog.create({
        data: {
          action: "SIGNAL_OVERRIDE_CANCEL",
          userId,
          signalId: params.signalId,
          metadata: {
            cancelledAt: new Date().toISOString(),
          },
        },
      }),
    ]);

    // Emit SSE event
    emitSSE("signal:update", {
      signalId: signal.id,
      currentPhase: signal.currentPhase,
      overrideActive: signal.overrideActive,
      overrideExpiresAt: null,
      aiOptimized: signal.aiOptimized,
      lastUpdatedAt: signal.lastUpdatedAt.toISOString(),
    });

    return NextResponse.json(signal, { status: 200 });
  } catch (error) {
    console.error("Error cancelling override:", error);
    return NextResponse.json(
      { error: "Failed to cancel override" },
      { status: 500 }
    );
  }
}
