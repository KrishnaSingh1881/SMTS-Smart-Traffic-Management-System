/**
 * Unit tests for routing service
 * Requirements: 6.1, 6.3, 6.5
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { findRoutes } from "@/lib/utils/routing";

describe("Routing Service", () => {
  let segmentA: string;
  let segmentB: string;
  let segmentC: string;
  let segmentD: string;
  let incidentSegment: string;

  beforeAll(async () => {
    // Create test road segments
    const segments = await Promise.all([
      prisma.roadSegment.create({
        data: {
          name: "Test Segment A",
          lengthMeters: 1000,
          speedLimitKmh: 50,
          currentCongestion: "Free",
        },
      }),
      prisma.roadSegment.create({
        data: {
          name: "Test Segment B",
          lengthMeters: 1500,
          speedLimitKmh: 60,
          currentCongestion: "Moderate",
        },
      }),
      prisma.roadSegment.create({
        data: {
          name: "Test Segment C",
          lengthMeters: 2000,
          speedLimitKmh: 50,
          currentCongestion: "Heavy",
        },
      }),
      prisma.roadSegment.create({
        data: {
          name: "Test Segment D",
          lengthMeters: 1200,
          speedLimitKmh: 60,
          currentCongestion: "Free",
        },
      }),
    ]);

    segmentA = segments[0].id;
    segmentB = segments[1].id;
    segmentC = segments[2].id;
    segmentD = segments[3].id;

    // Create route edges
    // A -> B (fast, moderate congestion)
    // A -> C (slow, heavy congestion)
    // B -> D (fast)
    // C -> D (medium)
    await Promise.all([
      prisma.routeEdge.create({
        data: {
          fromSegmentId: segmentA,
          toSegmentId: segmentB,
          baseTravelTime: 60, // 1 minute
        },
      }),
      prisma.routeEdge.create({
        data: {
          fromSegmentId: segmentA,
          toSegmentId: segmentC,
          baseTravelTime: 90, // 1.5 minutes
        },
      }),
      prisma.routeEdge.create({
        data: {
          fromSegmentId: segmentB,
          toSegmentId: segmentD,
          baseTravelTime: 50,
        },
      }),
      prisma.routeEdge.create({
        data: {
          fromSegmentId: segmentC,
          toSegmentId: segmentD,
          baseTravelTime: 70,
        },
      }),
    ]);

    // Create an active incident on segment C
    incidentSegment = segmentC;
    await prisma.incident.create({
      data: {
        segmentId: incidentSegment,
        type: "Accident",
        status: "Active",
        severity: 3,
        description: "Test incident",
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.incident.deleteMany({
      where: {
        segmentId: { in: [segmentA, segmentB, segmentC, segmentD] },
      },
    });
    await prisma.routeEdge.deleteMany({
      where: {
        fromSegmentId: { in: [segmentA, segmentB, segmentC, segmentD] },
      },
    });
    await prisma.roadSegment.deleteMany({
      where: {
        id: { in: [segmentA, segmentB, segmentC, segmentD] },
      },
    });
  });

  it("should return routes ordered by ascending estimated travel time", async () => {
    const result = await findRoutes(segmentA, segmentD);

    expect(result.routes).toBeDefined();
    expect(result.routes.length).toBeGreaterThan(0);

    // Route via B should be faster than route via C (due to congestion)
    const route = result.routes[0];
    expect(route.segments).toContain(segmentB);
    expect(route.estimatedTravelTimeSeconds).toBeGreaterThan(0);
  });

  it("should label route with active incident as affected_by_incident", async () => {
    const result = await findRoutes(segmentA, segmentD);

    expect(result.routes).toBeDefined();

    // Find route that goes through segment C (has incident)
    const routeThroughC = result.routes.find((r) =>
      r.segments.includes(incidentSegment)
    );

    if (routeThroughC) {
      expect(routeThroughC.affectedByIncident).toBe(true);
      expect(routeThroughC.incidentTypes).toContain("Accident");
    }

    // Route through B should not be affected
    const routeThroughB = result.routes.find(
      (r) => r.segments.includes(segmentB) && !r.segments.includes(segmentC)
    );

    if (routeThroughB) {
      expect(routeThroughB.affectedByIncident).toBe(false);
    }
  });

  it("should return empty array with message when no path exists", async () => {
    // Create isolated segment with no edges
    const isolatedSegment = await prisma.roadSegment.create({
      data: {
        name: "Isolated Segment",
        lengthMeters: 1000,
        speedLimitKmh: 50,
        currentCongestion: "Free",
      },
    });

    const result = await findRoutes(segmentA, isolatedSegment.id);

    expect(result.routes).toEqual([]);
    expect(result.message).toBeDefined();
    expect(result.message).toContain("No route available");

    // Clean up
    await prisma.roadSegment.delete({
      where: { id: isolatedSegment.id },
    });
  });

  it("should return message when origin segment not found", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const result = await findRoutes(fakeId, segmentD);

    expect(result.routes).toEqual([]);
    expect(result.message).toBeDefined();
  });

  it("should return message when destination segment not found", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const result = await findRoutes(segmentA, fakeId);

    expect(result.routes).toEqual([]);
    expect(result.message).toBeDefined();
  });
});
