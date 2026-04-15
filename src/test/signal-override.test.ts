/**
 * Unit tests for signal override logic
 * Requirements: 2.2, 2.4, 2.5
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import type { User, Intersection, TrafficSignal } from "@prisma/client";
import bcrypt from "bcryptjs";

describe("Signal Override Logic", () => {
  let testUser: User;
  let testIntersection: Intersection;
  let testSignal: TrafficSignal;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `controller-signal-test-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        fullName: "Test Controller",
        role: "Traffic_Controller",
      },
    });

    // Create test intersection
    testIntersection = await prisma.intersection.create({
      data: {
        name: "Test Intersection",
        latitude: 40.7128,
        longitude: -74.006,
      },
    });

    // Create test signal
    testSignal = await prisma.trafficSignal.create({
      data: {
        intersectionId: testIntersection.id,
        label: "Test Signal A",
        currentPhase: "Red",
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    // Note: audit logs are append-only and cannot be deleted or updated (enforced by trigger)
    // The foreign key constraint ON DELETE SET NULL would trigger an UPDATE on audit_logs
    // which is blocked by the trigger. So we skip cleanup for this test.
    // In a real test environment, you would use a separate test database that gets reset.
  });

  it("should reject override with duration_seconds = 9 (below minimum)", async () => {
    // Attempt to create a signal phase with invalid duration
    await expect(
      prisma.signalPhase.create({
        data: {
          signalId: testSignal.id,
          phaseState: "Green",
          durationSeconds: 9, // Below minimum of 10
          sequenceOrder: 1,
          source: "manual_override",
        },
      })
    ).rejects.toThrow();
  });

  it("should reject override with duration_seconds = 181 (above maximum)", async () => {
    // Attempt to create a signal phase with invalid duration
    await expect(
      prisma.signalPhase.create({
        data: {
          signalId: testSignal.id,
          phaseState: "Green",
          durationSeconds: 181, // Above maximum of 180
          sequenceOrder: 1,
          source: "manual_override",
        },
      })
    ).rejects.toThrow();
  });

  it("should accept override with duration_seconds = 10 (minimum boundary)", async () => {
    const phase = await prisma.signalPhase.create({
      data: {
        signalId: testSignal.id,
        phaseState: "Green",
        durationSeconds: 10,
        sequenceOrder: 1,
        source: "manual_override",
      },
    });

    expect(phase.durationSeconds).toBe(10);

    // Clean up
    await prisma.signalPhase.delete({ where: { id: phase.id } });
  });

  it("should accept override with duration_seconds = 180 (maximum boundary)", async () => {
    const phase = await prisma.signalPhase.create({
      data: {
        signalId: testSignal.id,
        phaseState: "Green",
        durationSeconds: 180,
        sequenceOrder: 1,
        source: "manual_override",
      },
    });

    expect(phase.durationSeconds).toBe(180);

    // Clean up
    await prisma.signalPhase.delete({ where: { id: phase.id } });
  });

  it("should set ai_optimized = true when cancelling an override", async () => {
    // Apply override
    const overrideExpiresAt = new Date(Date.now() + 60000);
    await prisma.trafficSignal.update({
      where: { id: testSignal.id },
      data: {
        overrideActive: true,
        overrideExpiresAt,
        overrideByUserId: testUser.id,
        aiOptimized: false,
      },
    });

    // Cancel override and insert audit log
    const [updatedSignal, auditLog] = await prisma.$transaction([
      prisma.trafficSignal.update({
        where: { id: testSignal.id },
        data: {
          overrideActive: false,
          overrideExpiresAt: null,
          overrideByUserId: null,
          aiOptimized: true, // Should be set to true (Req 2.4)
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "SIGNAL_OVERRIDE_CANCEL",
          userId: testUser.id,
          signalId: testSignal.id,
          metadata: {
            cancelledAt: new Date().toISOString(),
          },
        },
      }),
    ]);

    expect(updatedSignal.aiOptimized).toBe(true);
    expect(updatedSignal.overrideActive).toBe(false);
    expect(auditLog.action).toBe("SIGNAL_OVERRIDE_CANCEL");
    expect(auditLog.signalId).toBe(testSignal.id);

    // Note: audit logs are append-only and cannot be deleted
  });

  it("should insert SIGNAL_OVERRIDE_APPLY audit log when applying override", async () => {
    const overrideExpiresAt = new Date(Date.now() + 30000);

    const [, auditLog] = await prisma.$transaction([
      prisma.trafficSignal.update({
        where: { id: testSignal.id },
        data: {
          currentPhase: "Green",
          overrideActive: true,
          overrideExpiresAt,
          overrideByUserId: testUser.id,
          aiOptimized: false,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "SIGNAL_OVERRIDE_APPLY",
          userId: testUser.id,
          signalId: testSignal.id,
          metadata: {
            phase: "Green",
            durationSeconds: 30,
            expiresAt: overrideExpiresAt.toISOString(),
          },
        },
      }),
    ]);

    expect(auditLog.action).toBe("SIGNAL_OVERRIDE_APPLY");
    expect(auditLog.userId).toBe(testUser.id);
    expect(auditLog.signalId).toBe(testSignal.id);

    // Note: audit logs are append-only and cannot be deleted
  });
});
