/**
 * GET /api/predictions - Get latest predictions per segment
 * POST /api/predictions - Trigger prediction run
 * Requirements: 5.1, 5.2, 5.3
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { predictCongestion } from "@/lib/ai/congestionPredictor";

/**
 * GET /api/predictions
 * Returns latest predictions per segment with confidence score, predicted_at, and target_window_minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "Traffic_Controller") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get latest predictions per segment
    // We want the most recent prediction for each segment and target window
    const predictions = await prisma.congestionPrediction.findMany({
      orderBy: { predictedAt: "desc" },
      include: {
        segment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by segment and keep only the latest prediction for each window
    const latestBySegment = new Map<string, typeof predictions>();
    
    for (const pred of predictions) {
      const key = `${pred.segmentId}-${pred.targetWindowMinutes}`;
      if (!latestBySegment.has(key)) {
        latestBySegment.set(key, [pred]);
      }
    }

    // Flatten and format response
    const result = Array.from(latestBySegment.values())
      .flat()
      .map((p) => ({
        id: p.id,
        segmentId: p.segmentId,
        segmentName: p.segment.name,
        predictedLevel: p.predictedLevel,
        targetWindowMinutes: p.targetWindowMinutes,
        confidenceScore: p.modelConfidenceScore.toNumber(),
        predictedAt: p.predictedAt.toISOString(),
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error fetching predictions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/predictions
 * Trigger a prediction run for a specific segment or all segments
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "Traffic_Controller") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { segmentId } = body;

    if (segmentId) {
      // Trigger prediction for specific segment
      const success = await predictCongestion(segmentId);
      
      if (!success) {
        return NextResponse.json(
          { error: "Prediction failed. AI may be unavailable or segment not found." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Prediction generated for segment ${segmentId}`,
      });
    } else {
      // Trigger prediction for all segments
      const segments = await prisma.roadSegment.findMany({
        select: { id: true },
      });

      let successCount = 0;
      for (const segment of segments) {
        const success = await predictCongestion(segment.id);
        if (success) successCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Predictions generated for ${successCount}/${segments.length} segments`,
        successCount,
        totalSegments: segments.length,
      });
    }
  } catch (error) {
    console.error("[API] Error triggering predictions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
