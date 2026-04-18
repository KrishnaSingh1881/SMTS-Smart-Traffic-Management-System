/**
 * POST /api/signals/optimize-all
 * Trigger AI optimisation for all online signals.
 * Requirements: 14.2, 14.3
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { optimizeSignal } from "@/lib/ai/signalOptimizer";

export async function POST() {
  try {
    const signals = await prisma.trafficSignal.findMany({
      where: { isOnline: true },
      select: { id: true },
    });

    const total = signals.length;
    let optimized = 0;

    for (const signal of signals) {
      const success = await optimizeSignal(signal.id);
      if (success) optimized++;
    }

    return NextResponse.json({ optimized, total }, { status: 200 });
  } catch (error) {
    console.error("[API] Error in optimize-all:", error);
    return NextResponse.json(
      { error: "Failed to optimise signals" },
      { status: 500 }
    );
  }
}
