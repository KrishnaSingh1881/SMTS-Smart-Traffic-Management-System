/**
 * Typed query wrappers for incidents
 * Requirements: 10.4
 */

import { prisma } from "@/lib/db/prisma";
import type { Incident, IncidentStatus } from "@/types";

/**
 * Get all incidents with optional status filter
 */
export async function getAllIncidents(
  status?: IncidentStatus
): Promise<Incident[]> {
  const incidents = await prisma.incident.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return incidents.map((i) => ({
    id: i.id,
    segmentId: i.segmentId,
    type: i.type,
    status: i.status,
    severity: i.severity,
    description: i.description,
    reportedByUserId: i.reportedByUserId,
    resolvedByUserId: i.resolvedByUserId,
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));
}

/**
 * Get a single incident by ID
 */
export async function getIncidentById(id: string): Promise<Incident | null> {
  const incident = await prisma.incident.findUnique({
    where: { id },
  });

  if (!incident) return null;

  return {
    id: incident.id,
    segmentId: incident.segmentId,
    type: incident.type,
    status: incident.status,
    severity: incident.severity,
    description: incident.description,
    reportedByUserId: incident.reportedByUserId,
    resolvedByUserId: incident.resolvedByUserId,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

/**
 * Get all incidents for a specific segment
 */
export async function getIncidentsBySegment(
  segmentId: string
): Promise<Incident[]> {
  const incidents = await prisma.incident.findMany({
    where: { segmentId },
    orderBy: { createdAt: "desc" },
  });

  return incidents.map((i) => ({
    id: i.id,
    segmentId: i.segmentId,
    type: i.type,
    status: i.status,
    severity: i.severity,
    description: i.description,
    reportedByUserId: i.reportedByUserId,
    resolvedByUserId: i.resolvedByUserId,
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));
}

/**
 * Get active incidents (not resolved)
 */
export async function getActiveIncidents(): Promise<Incident[]> {
  return getAllIncidents("Active");
}
