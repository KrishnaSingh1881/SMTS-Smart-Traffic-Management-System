/**
 * Task 3.5 — Unit tests for stored procedures  (Req 1.2, 4.6)
 *
 * Tests the TypeScript-side logic that mirrors the PostgreSQL stored procedures.
 * Integration tests against a live DB are run via `prisma migrate dev` + psql.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mirror of compute_congestion_level logic (task 3.2)
// This will live in src/lib/utils/congestion.ts (task 7.5)
// ─────────────────────────────────────────────

type CongestionLevel = "Free" | "Moderate" | "Heavy" | "Gridlock";

function computeCongestionLevel(
  vehicleCount: number,
  avgSpeedKmh: number,
  speedLimitKmh: number
): CongestionLevel {
  if (speedLimitKmh <= 0) return "Gridlock";

  const speedRatio = avgSpeedKmh / speedLimitKmh;

  if (vehicleCount >= 80 || speedRatio < 0.2) return "Gridlock";
  if (vehicleCount >= 50 || speedRatio < 0.5) return "Heavy";
  if (vehicleCount >= 20 || speedRatio < 0.8) return "Moderate";
  return "Free";
}

// ─────────────────────────────────────────────
// Mirror of escalate_overdue_incidents logic (task 3.3)
// ─────────────────────────────────────────────

interface Incident {
  id: string;
  status: "Active" | "Resolved" | "Escalated";
  createdAt: Date;
}

function escalateOverdueIncidents(
  incidents: Incident[],
  now: Date = new Date()
): { escalated: string[]; count: number } {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const escalated: string[] = [];

  for (const incident of incidents) {
    if (incident.status === "Active" && incident.createdAt < twoHoursAgo) {
      incident.status = "Escalated";
      escalated.push(incident.id);
    }
  }

  return { escalated, count: escalated.length };
}

// ─────────────────────────────────────────────
// compute_congestion_level — boundary tests  (Req 1.2)
// ─────────────────────────────────────────────

describe("compute_congestion_level — congestion tier boundaries (Req 1.2)", () => {
  const LIMIT = 60; // speed limit km/h used throughout

  // ── Free tier ──────────────────────────────
  it("returns Free when vehicle_count < 20 and speed is near free-flow", () => {
    expect(computeCongestionLevel(10, 55, LIMIT)).toBe("Free");
  });

  it("returns Free at vehicle_count = 0 and full speed", () => {
    expect(computeCongestionLevel(0, 60, LIMIT)).toBe("Free");
  });

  it("returns Free at vehicle_count = 19 (just below Moderate threshold)", () => {
    expect(computeCongestionLevel(19, 55, LIMIT)).toBe("Free");
  });

  // ── Moderate tier ──────────────────────────
  it("returns Moderate at vehicle_count = 20 (lower boundary)", () => {
    expect(computeCongestionLevel(20, 55, LIMIT)).toBe("Moderate");
  });

  it("returns Moderate at vehicle_count = 49 (upper boundary)", () => {
    expect(computeCongestionLevel(49, 55, LIMIT)).toBe("Moderate");
  });

  it("returns Moderate when speed ratio is 0.5–0.79 regardless of count", () => {
    // speed = 36 km/h → ratio = 0.6 → Moderate
    expect(computeCongestionLevel(5, 36, LIMIT)).toBe("Moderate");
  });

  // ── Heavy tier ─────────────────────────────
  it("returns Heavy at vehicle_count = 50 (lower boundary)", () => {
    expect(computeCongestionLevel(50, 55, LIMIT)).toBe("Heavy");
  });

  it("returns Heavy at vehicle_count = 79 (upper boundary)", () => {
    expect(computeCongestionLevel(79, 55, LIMIT)).toBe("Heavy");
  });

  it("returns Heavy when speed ratio is 0.2–0.49 regardless of count", () => {
    // speed = 18 km/h → ratio = 0.3 → Heavy
    expect(computeCongestionLevel(5, 18, LIMIT)).toBe("Heavy");
  });

  // ── Gridlock tier ──────────────────────────
  it("returns Gridlock at vehicle_count = 80 (lower boundary)", () => {
    expect(computeCongestionLevel(80, 55, LIMIT)).toBe("Gridlock");
  });

  it("returns Gridlock at vehicle_count = 200", () => {
    expect(computeCongestionLevel(200, 55, LIMIT)).toBe("Gridlock");
  });

  it("returns Gridlock when speed ratio < 0.2 regardless of count", () => {
    // speed = 10 km/h → ratio = 0.167 → Gridlock
    expect(computeCongestionLevel(5, 10, LIMIT)).toBe("Gridlock");
  });

  it("returns Gridlock when speed = 0", () => {
    expect(computeCongestionLevel(30, 0, LIMIT)).toBe("Gridlock");
  });

  it("returns Gridlock when speed_limit = 0 (guard clause)", () => {
    expect(computeCongestionLevel(10, 50, 0)).toBe("Gridlock");
  });

  // ── Exact boundary: speed ratio = 0.8 ─────
  it("returns Free when speed ratio is exactly 0.8 and count < 20", () => {
    // speed = 48 km/h → ratio = 0.8 → Free (not < 0.8)
    expect(computeCongestionLevel(5, 48, LIMIT)).toBe("Free");
  });

  it("returns Moderate when speed ratio is just below 0.8 (0.799)", () => {
    // speed = 47.9 km/h → ratio ≈ 0.798 → Moderate
    expect(computeCongestionLevel(5, 47.9, LIMIT)).toBe("Moderate");
  });
});

// ─────────────────────────────────────────────
// escalate_overdue_incidents  (Req 4.6)
// ─────────────────────────────────────────────

describe("escalate_overdue_incidents (Req 4.6)", () => {
  const now = new Date("2024-06-01T12:00:00Z");
  const twoHoursAgo = new Date("2024-06-01T10:00:00Z");
  const oneHourAgo = new Date("2024-06-01T11:00:00Z");
  const twoHoursAndOneSecAgo = new Date("2024-06-01T09:59:59Z");

  it("escalates Active incidents older than 2 hours", () => {
    const incidents: Incident[] = [
      { id: "a", status: "Active", createdAt: twoHoursAndOneSecAgo },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(1);
    expect(incidents[0].status).toBe("Escalated");
  });

  it("does NOT escalate Active incidents exactly 2 hours old (boundary)", () => {
    const incidents: Incident[] = [
      { id: "b", status: "Active", createdAt: twoHoursAgo },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(0);
    expect(incidents[0].status).toBe("Active");
  });

  it("does NOT escalate Active incidents less than 2 hours old", () => {
    const incidents: Incident[] = [
      { id: "c", status: "Active", createdAt: oneHourAgo },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(0);
    expect(incidents[0].status).toBe("Active");
  });

  it("does NOT escalate already-Resolved incidents", () => {
    const incidents: Incident[] = [
      { id: "d", status: "Resolved", createdAt: twoHoursAndOneSecAgo },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(0);
    expect(incidents[0].status).toBe("Resolved");
  });

  it("does NOT escalate already-Escalated incidents", () => {
    const incidents: Incident[] = [
      { id: "e", status: "Escalated", createdAt: twoHoursAndOneSecAgo },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(0);
    expect(incidents[0].status).toBe("Escalated");
  });

  it("escalates only the overdue Active incidents from a mixed list", () => {
    const incidents: Incident[] = [
      { id: "f", status: "Active",    createdAt: twoHoursAndOneSecAgo }, // should escalate
      { id: "g", status: "Active",    createdAt: oneHourAgo },           // too recent
      { id: "h", status: "Resolved",  createdAt: twoHoursAndOneSecAgo }, // already resolved
      { id: "i", status: "Escalated", createdAt: twoHoursAndOneSecAgo }, // already escalated
    ];
    const { escalated, count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(1);
    expect(escalated).toEqual(["f"]);
    expect(incidents[0].status).toBe("Escalated");
    expect(incidents[1].status).toBe("Active");
    expect(incidents[2].status).toBe("Resolved");
    expect(incidents[3].status).toBe("Escalated");
  });

  it("returns count = 0 when no incidents are present", () => {
    const { count } = escalateOverdueIncidents([], now);
    expect(count).toBe(0);
  });

  it("escalates multiple overdue incidents and returns correct count", () => {
    const incidents: Incident[] = [
      { id: "j", status: "Active", createdAt: twoHoursAndOneSecAgo },
      { id: "k", status: "Active", createdAt: new Date("2024-06-01T08:00:00Z") },
    ];
    const { count } = escalateOverdueIncidents(incidents, now);
    expect(count).toBe(2);
  });
});
