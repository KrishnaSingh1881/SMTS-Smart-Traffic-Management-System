/**
 * Route query API endpoint
 * Requirements: 6.1, 6.5, 8.5
 *
 * POST /api/routes - Query routes between origin and destination
 * Role: Driver only
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { findRoutes } from "@/lib/utils/routing";

export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check - Driver only
    if (session.user.role !== "Driver") {
      return NextResponse.json(
        { error: "Forbidden: Driver role required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { origin_segment_id, destination_segment_id } = body;

    // Validate required fields
    if (!origin_segment_id || !destination_segment_id) {
      return NextResponse.json(
        {
          error: "Missing required fields: origin_segment_id, destination_segment_id",
        },
        { status: 400 }
      );
    }

    // Set 3-second timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 3000)
    );

    const routePromise = findRoutes(origin_segment_id, destination_segment_id);

    // Race between route computation and timeout
    const result = await Promise.race([routePromise, timeoutPromise]);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Request timeout") {
      return NextResponse.json(
        { error: "Route computation timed out" },
        { status: 504 }
      );
    }

    console.error("Route query error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
