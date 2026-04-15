/**
 * GET /api/signals
 * Return all traffic signals with current phase and override status.
 * Requirements: 2.1, 8.4
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const signals = await prisma.trafficSignal.findMany({
      include: {
        intersection: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: {
        label: "asc",
      },
    });

    return NextResponse.json(signals, { status: 200 });
  } catch (error) {
    console.error("Error fetching signals:", error);
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
