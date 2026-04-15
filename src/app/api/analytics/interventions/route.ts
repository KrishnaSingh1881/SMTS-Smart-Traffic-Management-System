/**
 * GET /api/analytics/interventions
 * Returns signal override and AI update history from audit log.
 * Requirements: 7.4, 7.5
 */

import { NextResponse } from "next/server";
import { getInterventionReport } from "@/lib/db/queries/storedProcedures";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const intersectionId = searchParams.get("intersection_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Validate required parameters
    if (!intersectionId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: intersection_id, start_date, end_date" },
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
    const data = await getInterventionReport(intersectionId, start, end);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching intervention report:", error);
    return NextResponse.json(
      { error: "Failed to fetch intervention report" },
      { status: 500 }
    );
  }
}
