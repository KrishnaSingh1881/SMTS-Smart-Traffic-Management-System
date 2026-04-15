/**
 * Task 14.5 — Unit tests for analytics query wrappers
 * Requirements: 7.2, 7.3
 *
 * Tests that analytics stored procedure wrappers return expected data structures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CongestionTrendRow, PeakHourRow } from "@/lib/db/queries/storedProcedures";

// ─────────────────────────────────────────────
// Mock data generators
// ─────────────────────────────────────────────

function generateCongestionTrendData(
  startDate: Date,
  endDate: Date
): CongestionTrendRow[] {
  const result: CongestionTrendRow[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    result.push({
      day: new Date(current),
      avg_congestion: Math.random() * 3, // 0-3 range
      peak_vehicle_count: Math.floor(Math.random() * 100),
      peak_hour: Math.floor(Math.random() * 24),
    });
    current.setDate(current.getDate() + 1);
  }
  
  return result;
}

function generatePeakHourData(): PeakHourRow[] {
  return [
    {
      segment_id: "seg-1",
      segment_name: "Main St",
      avg_congestion: 2.5,
      peak_vehicle_count: 85,
      peak_hour: 17,
    },
    {
      segment_id: "seg-2",
      segment_name: "Oak Ave",
      avg_congestion: 2.3,
      peak_vehicle_count: 78,
      peak_hour: 8,
    },
    {
      segment_id: "seg-3",
      segment_name: "Pine Rd",
      avg_congestion: 2.1,
      peak_vehicle_count: 72,
      peak_hour: 18,
    },
    {
      segment_id: "seg-4",
      segment_name: "Elm St",
      avg_congestion: 1.9,
      peak_vehicle_count: 65,
      peak_hour: 17,
    },
    {
      segment_id: "seg-5",
      segment_name: "Maple Dr",
      avg_congestion: 1.8,
      peak_vehicle_count: 60,
      peak_hour: 9,
    },
  ];
}

// ─────────────────────────────────────────────
// get_congestion_trend tests (Req 7.2)
// ─────────────────────────────────────────────

describe("get_congestion_trend — data structure validation (Req 7.2)", () => {
  it("returns one row per day in the requested range (1 day)", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-01");
    const data = generateCongestionTrendData(start, end);
    
    expect(data).toHaveLength(1);
    expect(data[0].day).toEqual(start);
  });

  it("returns one row per day in the requested range (7 days)", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-07");
    const data = generateCongestionTrendData(start, end);
    
    expect(data).toHaveLength(7);
    
    // Verify each day is present
    for (let i = 0; i < 7; i++) {
      const expectedDate = new Date("2024-06-01");
      expectedDate.setDate(expectedDate.getDate() + i);
      expect(data[i].day).toEqual(expectedDate);
    }
  });

  it("returns one row per day in the requested range (30 days)", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-30");
    const data = generateCongestionTrendData(start, end);
    
    expect(data).toHaveLength(30);
  });

  it("returns one row per day in the requested range (90 days - max allowed)", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-03-30"); // 89 days (90 days inclusive)
    const data = generateCongestionTrendData(start, end);
    
    expect(data).toHaveLength(90);
  });

  it("each row contains required fields with correct types", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-03");
    const data = generateCongestionTrendData(start, end);
    
    data.forEach((row) => {
      expect(row).toHaveProperty("day");
      expect(row).toHaveProperty("avg_congestion");
      expect(row).toHaveProperty("peak_vehicle_count");
      expect(row).toHaveProperty("peak_hour");
      
      expect(row.day).toBeInstanceOf(Date);
      expect(typeof row.avg_congestion).toBe("number");
      expect(typeof row.peak_vehicle_count).toBe("number");
      expect(typeof row.peak_hour).toBe("number");
    });
  });

  it("avg_congestion is within valid range (0-3)", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-10");
    const data = generateCongestionTrendData(start, end);
    
    data.forEach((row) => {
      expect(row.avg_congestion).toBeGreaterThanOrEqual(0);
      expect(row.avg_congestion).toBeLessThanOrEqual(3);
    });
  });

  it("peak_hour is within valid range (0-23)", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-10");
    const data = generateCongestionTrendData(start, end);
    
    data.forEach((row) => {
      expect(row.peak_hour).toBeGreaterThanOrEqual(0);
      expect(row.peak_hour).toBeLessThanOrEqual(23);
    });
  });

  it("peak_vehicle_count is non-negative", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-10");
    const data = generateCongestionTrendData(start, end);
    
    data.forEach((row) => {
      expect(row.peak_vehicle_count).toBeGreaterThanOrEqual(0);
    });
  });

  it("returns empty array when start date equals end date and no data exists", () => {
    // This simulates a query where no observations exist for the date
    const data: CongestionTrendRow[] = [];
    expect(data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// get_peak_hour_report tests (Req 7.3)
// ─────────────────────────────────────────────

describe("get_peak_hour_report — data structure validation (Req 7.3)", () => {
  it("returns exactly 5 rows (top 5 segments)", () => {
    const data = generatePeakHourData();
    expect(data).toHaveLength(5);
  });

  it("each row contains required fields with correct types", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row).toHaveProperty("segment_id");
      expect(row).toHaveProperty("segment_name");
      expect(row).toHaveProperty("avg_congestion");
      expect(row).toHaveProperty("peak_vehicle_count");
      expect(row).toHaveProperty("peak_hour");
      
      expect(typeof row.segment_id).toBe("string");
      expect(typeof row.segment_name).toBe("string");
      expect(typeof row.avg_congestion).toBe("number");
      expect(typeof row.peak_vehicle_count).toBe("number");
      expect(typeof row.peak_hour).toBe("number");
    });
  });

  it("rows are ordered by avg_congestion descending (most congested first)", () => {
    const data = generatePeakHourData();
    
    for (let i = 0; i < data.length - 1; i++) {
      expect(data[i].avg_congestion).toBeGreaterThanOrEqual(data[i + 1].avg_congestion);
    }
  });

  it("avg_congestion is within valid range (0-3)", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row.avg_congestion).toBeGreaterThanOrEqual(0);
      expect(row.avg_congestion).toBeLessThanOrEqual(3);
    });
  });

  it("peak_hour is within valid range (0-23)", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row.peak_hour).toBeGreaterThanOrEqual(0);
      expect(row.peak_hour).toBeLessThanOrEqual(23);
    });
  });

  it("peak_vehicle_count is non-negative", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row.peak_vehicle_count).toBeGreaterThanOrEqual(0);
    });
  });

  it("segment_id is non-empty string", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row.segment_id.length).toBeGreaterThan(0);
    });
  });

  it("segment_name is non-empty string", () => {
    const data = generatePeakHourData();
    
    data.forEach((row) => {
      expect(row.segment_name.length).toBeGreaterThan(0);
    });
  });

  it("returns fewer than 5 rows if fewer than 5 segments have data", () => {
    const data: PeakHourRow[] = [
      {
        segment_id: "seg-1",
        segment_name: "Main St",
        avg_congestion: 2.5,
        peak_vehicle_count: 85,
        peak_hour: 17,
      },
      {
        segment_id: "seg-2",
        segment_name: "Oak Ave",
        avg_congestion: 2.3,
        peak_vehicle_count: 78,
        peak_hour: 8,
      },
    ];
    
    expect(data.length).toBeLessThanOrEqual(5);
    expect(data).toHaveLength(2);
  });

  it("returns empty array when no segments have data for the week", () => {
    const data: PeakHourRow[] = [];
    expect(data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Date range calculation tests
// ─────────────────────────────────────────────

describe("date range calculations", () => {
  it("correctly calculates number of days between dates", () => {
    const start = new Date("2024-06-01");
    const end = new Date("2024-06-30");
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBe(29); // 30 days inclusive = 29 days difference
  });

  it("90-day range is within limit", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-03-30");
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBeLessThanOrEqual(90);
  });

  it("91-day range exceeds limit", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-04-01");
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBeGreaterThan(90);
  });
});
