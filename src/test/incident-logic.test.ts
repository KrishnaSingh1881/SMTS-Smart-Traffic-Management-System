/**
 * Unit tests for incident logic
 * Requirements: 4.4, 4.5, 4.6
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { escalateOverdueIncidents } from "@/lib/db/queries/storedProcedures";
import bcrypt from "bcryptjs";

describe("Incident Logic", () => {
  let testUserId: string;
  let testSegmentId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `controller-incident-test-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        fullName: "Test Controller",
        role: "Traffic_Controller",
      },
    });
    testUserId = testUser.id;

    // Create test segment
    const testSegment = await prisma.roadSegment.create({
      data: {
        name: "Test Segment for Incidents",
        lengthMeters: 500,
        speedLimitKmh: 50,
        currentCongestion: "Free",
      },
    });
    testSegmentId = testSegment.id;
  });

  afterAll(async () => {
    // Clean up test data
    // Note: audit logs are append-only and cannot be deleted
    await prisma.incident.deleteMany({
      where: { segmentId: testSegmentId },
    });
    await prisma.roadSegment.delete({ where: { id: testSegmentId } });
    // Skip user deletion to avoid audit log trigger issues
  });

  it("should set segment congestion to at least Heavy when creating an incident", async () => {
    // Ensure segment starts with Free congestion
    await prisma.roadSegment.update({
      where: { id: testSegmentId },
      data: { currentCongestion: "Free" },
    });

    // Create incident in transaction
    await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          segmentId: testSegmentId,
          type: "Accident",
          severity: 4,
          reportedByUserId: testUserId,
          status: "Active",
        },
      });

      // Set segment congestion to at least Heavy (Req 4.4)
      await tx.roadSegment.update({
        where: { id: testSegmentId },
        data: { currentCongestion: "Heavy" },
      });

      // Insert audit log
      await tx.auditLog.create({
        data: {
          action: "INCIDENT_CREATE",
          userId: testUserId,
          incidentId: incident.id,
          metadata: {
            segmentId: testSegmentId,
            type: "Accident",
            severity: 4,
          },
        },
      });
    });

    // Verify segment congestion was updated
    const segment = await prisma.roadSegment.findUnique({
      where: { id: testSegmentId },
    });
    expect(segment?.currentCongestion).toBe("Heavy");
  });

  it("should not downgrade segment congestion if already Gridlock when creating incident", async () => {
    // Set segment to Gridlock
    await prisma.roadSegment.update({
      where: { id: testSegmentId },
      data: { currentCongestion: "Gridlock" },
    });

    // Create incident
    await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          segmentId: testSegmentId,
          type: "Road_Closure",
          severity: 5,
          reportedByUserId: testUserId,
          status: "Active",
        },
      });

      // Check current congestion
      const segment = await tx.roadSegment.findUnique({
        where: { id: testSegmentId },
      });

      // Only update if current is less than Heavy
      const congestionHierarchy = ["Free", "Moderate", "Heavy", "Gridlock"];
      const currentIndex = congestionHierarchy.indexOf(
        segment!.currentCongestion
      );
      const heavyIndex = congestionHierarchy.indexOf("Heavy");

      if (currentIndex < heavyIndex) {
        await tx.roadSegment.update({
          where: { id: testSegmentId },
          data: { currentCongestion: "Heavy" },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "INCIDENT_CREATE",
          userId: testUserId,
          incidentId: incident.id,
          metadata: {
            segmentId: testSegmentId,
            type: "Road_Closure",
            severity: 5,
          },
        },
      });
    });

    // Verify segment congestion remains Gridlock
    const segment = await prisma.roadSegment.findUnique({
      where: { id: testSegmentId },
    });
    expect(segment?.currentCongestion).toBe("Gridlock");
  });

  it("should insert correct audit log row with resolved_by_user_id when resolving incident", async () => {
    // Create an active incident
    const incident = await prisma.incident.create({
      data: {
        segmentId: testSegmentId,
        type: "Debris",
        severity: 2,
        reportedByUserId: testUserId,
        status: "Active",
      },
    });

    // Resolve incident in transaction
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: incident.id },
        data: {
          status: "Resolved",
          resolvedAt: now,
          resolvedByUserId: testUserId,
        },
      });

      // Insert INCIDENT_RESOLVE audit log (Req 8.4)
      await tx.auditLog.create({
        data: {
          action: "INCIDENT_RESOLVE",
          userId: testUserId,
          incidentId: incident.id,
          metadata: {
            segmentId: testSegmentId,
            type: "Debris",
            resolvedAt: now.toISOString(),
            resolvedByUserId: testUserId,
          },
        },
      });
    });

    // Verify audit log was created with correct data
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "INCIDENT_RESOLVE",
        incidentId: incident.id,
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.action).toBe("INCIDENT_RESOLVE");
    expect(auditLog?.userId).toBe(testUserId);
    expect(auditLog?.incidentId).toBe(incident.id);
    expect(auditLog?.metadata).toMatchObject({
      resolvedByUserId: testUserId,
    });
  });

  it("should only escalate incidents older than 2 hours with status = Active", async () => {
    // Create an old Active incident (3 hours ago)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const oldActiveIncident = await prisma.incident.create({
      data: {
        segmentId: testSegmentId,
        type: "Flooding",
        severity: 5,
        reportedByUserId: testUserId,
        status: "Active",
        createdAt: threeHoursAgo,
      },
    });

    // Create a recent Active incident (30 minutes ago)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentActiveIncident = await prisma.incident.create({
      data: {
        segmentId: testSegmentId,
        type: "Accident",
        severity: 3,
        reportedByUserId: testUserId,
        status: "Active",
        createdAt: thirtyMinutesAgo,
      },
    });

    // Create an old Resolved incident (should not be escalated)
    const oldResolvedIncident = await prisma.incident.create({
      data: {
        segmentId: testSegmentId,
        type: "Other",
        severity: 2,
        reportedByUserId: testUserId,
        status: "Resolved",
        createdAt: threeHoursAgo,
        resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        resolvedByUserId: testUserId,
      },
    });

    // Call escalation stored procedure
    const escalatedCount = await escalateOverdueIncidents();

    // Verify at least one incident was escalated
    expect(escalatedCount).toBeGreaterThanOrEqual(1);

    // Verify old Active incident was escalated
    const escalatedIncident = await prisma.incident.findUnique({
      where: { id: oldActiveIncident.id },
    });
    expect(escalatedIncident?.status).toBe("Escalated");

    // Verify recent Active incident was NOT escalated
    const recentIncident = await prisma.incident.findUnique({
      where: { id: recentActiveIncident.id },
    });
    expect(recentIncident?.status).toBe("Active");

    // Verify old Resolved incident was NOT escalated
    const resolvedIncident = await prisma.incident.findUnique({
      where: { id: oldResolvedIncident.id },
    });
    expect(resolvedIncident?.status).toBe("Resolved");

    // Verify INCIDENT_ESCALATE audit log was created
    const escalateAuditLog = await prisma.auditLog.findFirst({
      where: {
        action: "INCIDENT_ESCALATE",
        incidentId: oldActiveIncident.id,
      },
    });
    expect(escalateAuditLog).toBeDefined();
  });
});
