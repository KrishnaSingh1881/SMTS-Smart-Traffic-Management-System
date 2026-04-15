/**
 * POST /api/signals/[signalId]/optimize
 * Manually trigger AI optimization for a specific signal.
 * Requirements: 3.1, 3.4
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { optimizeSignal } from "@/lib/ai/signalOptimizer";

export async function POST(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "Traffic_Controller") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { signalId } = params;

    if (!signalId) {
      return NextResponse.json(
        { error: "Signal ID is required" },
        { status: 400 }
      );
    }

    // Trigger optimization
    const success = await optimizeSignal(signalId);

    if (!success) {
      return NextResponse.json(
        {
          error:
            "Optimization failed. Signal may have active override or AI may be unavailable.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Signal optimization applied successfully",
    });
  } catch (error) {
    console.error("[API] Error in signal optimization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
