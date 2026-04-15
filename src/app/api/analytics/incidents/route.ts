/**
 * GET /api/analytics/incidents
 * Returns incident history for a segment or date range.
 * Requirements: 7.5, 7.6
 */

import { NextResponse } from "next/server";
import { getIncidentHistory } from "@/lib/db/queries/storedProcedures";

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

    if (start > end) {
      return NextResponse.json(
        { error: "start_date must be before or equal to end_date" },
        { status: 400 }
      );
    }

    // Call stored procedure
    const data = await getIncidentHistory(segmentId, start, end);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching incident history:", error);
    return NextResponse.json(
      { error: "Failed to fetch incident history" },
      { status: 500 }
    );
  }
}
