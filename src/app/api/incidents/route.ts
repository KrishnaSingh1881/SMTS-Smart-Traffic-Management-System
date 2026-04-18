/**
 * GET /api/incidents — List incidents with filters
 * POST /api/incidents — Create new incident
 * Requirements: 4.2, 4.3, 4.4, 4.5, 8.4, 9.5
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";
import { Prisma } from "@prisma/client";
import type { IncidentType, IncidentStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get("segment_id");
    const status = searchParams.get("status") as IncidentStatus | null;

    const where: Record<string, unknown> = {};
    if (segmentId) where.segmentId = segmentId;
    if (status) where.status = status;

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            geometry: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(incidents, { status: 200 });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Get authenticated user session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { segment_id, type, severity, description } = body as Record<
    string,
    unknown
  >;

  // Validate required fields
  const validTypes: IncidentType[] = [
    "Accident",
    "Road_Closure",
    "Debris",
    "Flooding",
    "Other",
  ];

  if (
    typeof segment_id !== "string" ||
    segment_id.trim() === "" ||
    typeof type !== "string" ||
    !validTypes.includes(type as IncidentType) ||
    typeof severity !== "number" ||
    severity < 1 ||
    severity > 5
  ) {
    return NextResponse.json(
      {
        error: `Missing or invalid fields. Required: segment_id (string), type (${validTypes.join(" | ")}), severity (1-5)`,
      },
      { status: 400 }
    );
  }

  try {
    const auditMetadata: Prisma.InputJsonObject = {
      segmentId: segment_id,
      type,
      severity,
      description: typeof description === "string" ? description : null,
    };

    // Transaction: create incident + set segment congestion to at least Heavy + audit log
    const result = await prisma.$transaction(async (tx) => {
      // Create incident
      const incident = await tx.incident.create({
        data: {
          segmentId: segment_id,
          type: type as IncidentType,
          severity,
          description:
            typeof description === "string" ? description : null,
          reportedByUserId: session.user.id,
          status: "Active",
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
              currentCongestion: true,
            },
          },
        },
      });

      // Set segment congestion to at least Heavy (Req 4.4)
      const currentCongestion = incident.segment.currentCongestion;
      const congestionHierarchy = ["Free", "Moderate", "Heavy", "Gridlock"];
      const currentIndex = congestionHierarchy.indexOf(currentCongestion);
      const heavyIndex = congestionHierarchy.indexOf("Heavy");

      if (currentIndex < heavyIndex) {
        await tx.roadSegment.update({
          where: { id: segment_id },
          data: { currentCongestion: "Heavy" },
        });
      }

      // Insert INCIDENT_CREATE audit log (Req 8.4)
      await tx.auditLog.create({
        data: {
          action: "INCIDENT_CREATE",
          userId: session.user.id,
          incidentId: incident.id,
          metadata: auditMetadata,
        },
      });

      return incident;
    });

    // Emit SSE event
    emitSSE("incident:new", {
      incidentId: result.id,
      segmentId: result.segmentId,
      type: result.type,
      severity: result.severity,
      status: result.status,
      createdAt: result.createdAt.toISOString(),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 }
    );
  }
}
