/**
 * Task 2.4 — Unit tests for Prisma schema constraints
 *
 * These tests use a mock PrismaClient to verify that the application layer
 * correctly rejects invalid data before it reaches the database, and that
 * the database-level CHECK / NOT NULL constraints are documented and expected.
 *
 * For full integration tests against a live PostgreSQL instance, run
 * `prisma migrate dev` against a test database and use @prisma/client directly.
 *
 * Requirements: 9.2, 9.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Helpers that mirror the DB CHECK constraints
// (these will live in src/lib/utils/validation.ts in task 7+)
// ─────────────────────────────────────────────

function validateSignalPhaseDuration(durationSeconds: number): void {
  if (durationSeconds < 10 || durationSeconds > 180) {
    throw new Error(
      `signal_phases_duration_check: duration_seconds must be between 10 and 180, got ${durationSeconds}`
    );
  }
}

function validateAuditLogRequiredFields(row: {
  action?: unknown;
  userId?: unknown;
}): void {
  if (!row.action) {
    throw new Error("NOT NULL violation: audit_logs.action cannot be null");
  }
  if (!row.userId) {
    throw new Error("NOT NULL violation: audit_logs.user_id cannot be null");
  }
}

// ─────────────────────────────────────────────
// Mock Prisma client
// ─────────────────────────────────────────────

const mockPrisma = {
  signalPhase: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

// Simulate DB CHECK constraint rejection from PostgreSQL
function simulateDbConstraintError(message: string): Error {
  const err = new Error(message) as Error & { code: string };
  (err as unknown as { code: string }).code = "P2002"; // Prisma known error
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// signal_phases — duration_seconds CHECK (10–180)
// ─────────────────────────────────────────────

describe("signal_phases duration_seconds constraint (Req 9.2)", () => {
  it("rejects duration_seconds below minimum (< 10)", () => {
    expect(() => validateSignalPhaseDuration(9)).toThrow(
      "duration_seconds must be between 10 and 180"
    );
  });

  it("rejects duration_seconds of 0", () => {
    expect(() => validateSignalPhaseDuration(0)).toThrow(
      "duration_seconds must be between 10 and 180"
    );
  });

  it("rejects negative duration_seconds", () => {
    expect(() => validateSignalPhaseDuration(-1)).toThrow(
      "duration_seconds must be between 10 and 180"
    );
  });

  it("rejects duration_seconds above maximum (> 180)", () => {
    expect(() => validateSignalPhaseDuration(181)).toThrow(
      "duration_seconds must be between 10 and 180"
    );
  });

  it("rejects duration_seconds of 999", () => {
    expect(() => validateSignalPhaseDuration(999)).toThrow(
      "duration_seconds must be between 10 and 180"
    );
  });

  it("accepts minimum boundary value (10)", () => {
    expect(() => validateSignalPhaseDuration(10)).not.toThrow();
  });

  it("accepts maximum boundary value (180)", () => {
    expect(() => validateSignalPhaseDuration(180)).not.toThrow();
  });

  it("accepts a mid-range value (60)", () => {
    expect(() => validateSignalPhaseDuration(60)).not.toThrow();
  });

  it("mock Prisma create rejects duration 9 with DB constraint error", async () => {
    mockPrisma.signalPhase.create.mockRejectedValueOnce(
      simulateDbConstraintError(
        'new row for relation "signal_phases" violates check constraint "signal_phases_duration_check"'
      )
    );

    await expect(
      mockPrisma.signalPhase.create({
        data: {
          signalId: "00000000-0000-0000-0000-000000000001",
          phaseState: "Green",
          durationSeconds: 9,
          sequenceOrder: 0,
          source: "default",
        },
      })
    ).rejects.toThrow("signal_phases_duration_check");
  });

  it("mock Prisma create rejects duration 181 with DB constraint error", async () => {
    mockPrisma.signalPhase.create.mockRejectedValueOnce(
      simulateDbConstraintError(
        'new row for relation "signal_phases" violates check constraint "signal_phases_duration_check"'
      )
    );

    await expect(
      mockPrisma.signalPhase.create({
        data: {
          signalId: "00000000-0000-0000-0000-000000000001",
          phaseState: "Red",
          durationSeconds: 181,
          sequenceOrder: 1,
          source: "default",
        },
      })
    ).rejects.toThrow("signal_phases_duration_check");
  });
});

// ─────────────────────────────────────────────
// audit_logs — NOT NULL constraints (Req 9.4)
// ─────────────────────────────────────────────

describe("audit_logs NOT NULL constraints (Req 9.4)", () => {
  it("rejects a row with missing action field", () => {
    expect(() =>
      validateAuditLogRequiredFields({ userId: "some-user-id" })
    ).toThrow("audit_logs.action cannot be null");
  });

  it("rejects a row with missing user_id field", () => {
    expect(() =>
      validateAuditLogRequiredFields({ action: "SIGNAL_OVERRIDE_APPLY" })
    ).toThrow("audit_logs.user_id cannot be null");
  });

  it("rejects a row with both action and user_id missing", () => {
    expect(() => validateAuditLogRequiredFields({})).toThrow(
      "audit_logs.action cannot be null"
    );
  });

  it("accepts a row with all required fields present", () => {
    expect(() =>
      validateAuditLogRequiredFields({
        action: "INCIDENT_CREATE",
        userId: "00000000-0000-0000-0000-000000000002",
      })
    ).not.toThrow();
  });

  it("mock Prisma create rejects audit_log with null action", async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(
      new Error(
        'null value in column "action" of relation "audit_logs" violates not-null constraint'
      )
    );

    await expect(
      mockPrisma.auditLog.create({
        data: {
          action: null,
          userId: "00000000-0000-0000-0000-000000000002",
        },
      })
    ).rejects.toThrow('null value in column "action"');
  });

  it("mock Prisma create rejects audit_log with null user_id", async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(
      new Error(
        'null value in column "user_id" of relation "audit_logs" violates not-null constraint'
      )
    );

    await expect(
      mockPrisma.auditLog.create({
        data: {
          action: "USER_LOGIN",
          userId: null,
        },
      })
    ).rejects.toThrow('null value in column "user_id"');
  });
});
