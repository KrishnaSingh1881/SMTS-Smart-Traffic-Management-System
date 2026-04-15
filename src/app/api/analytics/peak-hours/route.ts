/**
 * GET /api/analytics/peak-hours
 * Returns top 5 most congested segments for a given week.
 * Requirements: 7.3
 */

import { NextResponse } from "next/server";
import { getPeakHourReport } from "@/lib/db/queries/storedProcedures";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start");

    // Validate required parameter
    if (!weekStart) {
      return NextResponse.json(
        { error: "Missing required parameter: week_start (ISO date format)" },
        { status: 400 }
      );
    }

    // Parse date
    const start = new Date(weekStart);

    if (isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Call stored procedure
    const data = await getPeakHourReport(start);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching peak hours report:", error);
    return NextResponse.json(
      { error: "Failed to fetch peak hours report" },
      { status: 500 }
    );
  }
}
