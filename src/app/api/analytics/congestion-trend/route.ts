/**
 * GET /api/analytics/congestion-trend
 * Returns congestion trend data for a segment over a date range.
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { NextResponse } from "next/server";
import { getCongestionTrend } from "@/lib/db/queries/storedProcedures";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get("segment_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Validate required parameters
    if (!segmentId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: segment_id, start_date, end_date" },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Enforce 90-day range limit (Req 7.2)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: "Date range cannot exceed 90 days" },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "start_date must be before or equal to end_date" },
        { status: 400 }
      );
    }

    // Call stored procedure with 5s timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), 5000)
    );

    const dataPromise = getCongestionTrend(segmentId, start, end);

    const data = await Promise.race([dataPromise, timeoutPromise]);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching congestion trend:", error);
    
    if (error instanceof Error && error.message === "Query timeout") {
      return NextResponse.json(
        { error: "Query exceeded 5 second timeout" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch congestion trend" },
      { status: 500 }
    );
  }
}
