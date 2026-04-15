/**
 * GET /api/incidents/[incidentId] — Get single incident
 * PATCH /api/incidents/[incidentId] — Resolve incident
 * Requirements: 4.4, 4.5, 8.4, 9.5
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { emitSSE } from "@/lib/sse/emitter";

export async function GET(
  request: Request,
  { params }: { params: { incidentId: string } }
) {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: params.incidentId },
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            currentCongestion: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(incident, { status: 200 });
  } catch (error) {
    console.error("Error fetching incident:", error);
    return NextResponse.json(
      { error: "Failed to fetch incident" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { incidentId: string } }
) {
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

  const { action } = body as Record<string, unknown>;

  // Only support "resolve" action for now
  if (action !== "resolve") {
    return NextResponse.json(
      { error: 'Invalid action. Only "resolve" is supported.' },
      { status: 400 }
    );
  }

  try {
    // Transaction: update incident status + record resolved_at and resolved_by_user_id + audit log
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Update incident (Req 4.5)
      const incident = await tx.incident.update({
        where: { id: params.incidentId },
        data: {
          status: "Resolved",
          resolvedAt: now,
          resolvedByUserId: session.user.id,
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      // Insert INCIDENT_RESOLVE audit log (Req 8.4)
      await tx.auditLog.create({
        data: {
          action: "INCIDENT_RESOLVE",
          userId: session.user.id,
          incidentId: incident.id,
          metadata: {
            segmentId: incident.segmentId,
            type: incident.type,
            resolvedAt: now.toISOString(),
            resolvedByUserId: session.user.id,
          },
        },
      });

      return incident;
    });

    // Emit SSE event
    emitSSE("incident:update", {
      incidentId: result.id,
      segmentId: result.segmentId,
      status: result.status,
      resolvedAt: result.resolvedAt?.toISOString(),
      resolvedBy: result.resolvedBy?.fullName,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error resolving incident:", error);
    return NextResponse.json(
      { error: "Failed to resolve incident" },
      { status: 500 }
    );
  }
}
