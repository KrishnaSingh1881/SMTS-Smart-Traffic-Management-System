/**
 * Dijkstra-based routing service for route recommendations
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { prisma } from "@/lib/db/prisma";
import type { CongestionLevel } from "@prisma/client";

export interface Route {
  segments: string[];
  estimatedTravelTimeSeconds: number;
  affectedByIncident: boolean;
  incidentTypes?: string[];
}

interface GraphNode {
  segmentId: string;
  distance: number;
  previous: string | null;
}

interface Edge {
  toSegmentId: string;
  weight: number;
}

/**
 * Compute edge weight based on congestion level and speed
 * Heavier congestion = higher weight
 */
function computeEdgeWeight(
  baseTravelTime: number,
  congestionLevel: CongestionLevel,
  avgSpeedKmh: number | null,
  speedLimitKmh: number,
  predictedLevel?: CongestionLevel
): number {
  // Use prediction if available, otherwise use current congestion
  const effectiveLevel = predictedLevel ?? congestionLevel;

  // Congestion multipliers
  const congestionMultipliers: Record<CongestionLevel, number> = {
    Free: 1.0,
    Moderate: 1.5,
    Heavy: 2.5,
    Gridlock: 4.0,
  };

  let weight = baseTravelTime * congestionMultipliers[effectiveLevel];

  // Further adjust by actual speed if available
  if (avgSpeedKmh !== null && avgSpeedKmh > 0 && speedLimitKmh > 0) {
    const speedRatio = speedLimitKmh / avgSpeedKmh;
    weight *= speedRatio;
  }

  return weight;
}

/**
 * Find up to 3 routes from origin to destination using Dijkstra's algorithm
 * Returns routes ordered by estimated travel time
 */
export async function findRoutes(
  originSegmentId: string,
  destinationSegmentId: string
): Promise<{ routes: Route[]; message?: string }> {
  // Fetch all edges and segment data
  const [edges, segments, incidents, predictions] = await Promise.all([
    prisma.routeEdge.findMany({
      select: {
        fromSegmentId: true,
        toSegmentId: true,
        baseTravelTime: true,
      },
    }),
    prisma.roadSegment.findMany({
      select: {
        id: true,
        currentCongestion: true,
        speedLimitKmh: true,
        name: true,
      },
    }),
    prisma.incident.findMany({
      where: { status: "Active" },
      select: {
        segmentId: true,
        type: true,
      },
    }),
    prisma.congestionPrediction.findMany({
      where: {
        predictedAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
      orderBy: {
        predictedAt: "desc",
      },
      distinct: ["segmentId"],
      select: {
        segmentId: true,
        predictedLevel: true,
      },
    }),
  ]);

  // Build segment lookup map
  const segmentMap = new Map(
    segments.map((s) => [
      s.id,
      {
        congestion: s.currentCongestion,
        speedLimit: s.speedLimitKmh,
        name: s.name,
      },
    ])
  );

  // Build prediction map
  const predictionMap = new Map(
    predictions.map((p) => [p.segmentId, p.predictedLevel])
  );

  // Build incident map
  const incidentMap = new Map<string, string[]>();
  for (const incident of incidents) {
    const types = incidentMap.get(incident.segmentId) ?? [];
    types.push(incident.type);
    incidentMap.set(incident.segmentId, types);
  }

  // Build adjacency graph
  const graph = new Map<string, Edge[]>();
  for (const edge of edges) {
    const segmentData = segmentMap.get(edge.toSegmentId);
    if (!segmentData) continue;

    const weight = computeEdgeWeight(
      edge.baseTravelTime,
      segmentData.congestion,
      null, // avgSpeedKmh not available in this query
      segmentData.speedLimit,
      predictionMap.get(edge.toSegmentId)
    );

    const neighbors = graph.get(edge.fromSegmentId) ?? [];
    neighbors.push({ toSegmentId: edge.toSegmentId, weight });
    graph.set(edge.fromSegmentId, neighbors);
  }

  // Validate origin and destination exist
  if (!graph.has(originSegmentId) && !segmentMap.has(originSegmentId)) {
    return {
      routes: [],
      message: "Origin segment not found in road network",
    };
  }

  if (!segmentMap.has(destinationSegmentId)) {
    return {
      routes: [],
      message: "Destination segment not found in road network",
    };
  }

  // Run Dijkstra to find shortest path
  const shortestPath = dijkstra(graph, originSegmentId, destinationSegmentId);

  if (!shortestPath) {
    return {
      routes: [],
      message: "No route available between origin and destination",
    };
  }

  // Build route object
  const route = buildRoute(shortestPath, graph, incidentMap);

  // For now, return single route (could implement k-shortest paths for alternatives)
  return {
    routes: [route],
  };
}

/**
 * Dijkstra's shortest path algorithm
 */
function dijkstra(
  graph: Map<string, Edge[]>,
  start: string,
  end: string
): string[] | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  // Initialize all nodes
  distances.set(start, 0);
  previous.set(start, null);

  // Add all nodes from graph
  for (const node of Array.from(graph.keys())) {
    if (node !== start) {
      distances.set(node, Infinity);
      previous.set(node, null);
    }
    unvisited.add(node);
  }

  // Also add all destination nodes (they might not be in graph keys)
  for (const edges of Array.from(graph.values())) {
    for (const { toSegmentId } of edges) {
      if (!distances.has(toSegmentId)) {
        distances.set(toSegmentId, Infinity);
        previous.set(toSegmentId, null);
        unvisited.add(toSegmentId);
      }
    }
  }

  while (unvisited.size > 0) {
    // Find node with minimum distance
    let current: string | null = null;
    let minDistance = Infinity;

    for (const node of Array.from(unvisited)) {
      const dist = distances.get(node) ?? Infinity;
      if (dist < minDistance) {
        minDistance = dist;
        current = node;
      }
    }

    if (current === null || minDistance === Infinity) {
      break; // No path exists
    }

    if (current === end) {
      break; // Found destination
    }

    unvisited.delete(current);

    // Update neighbors
    const neighbors = graph.get(current) ?? [];
    for (const { toSegmentId, weight } of neighbors) {
      const altDistance = (distances.get(current) ?? Infinity) + weight;
      if (altDistance < (distances.get(toSegmentId) ?? Infinity)) {
        distances.set(toSegmentId, altDistance);
        previous.set(toSegmentId, current);
      }
    }
  }

  // Reconstruct path
  if (!distances.has(end) || distances.get(end) === Infinity) {
    return null; // No path found
  }

  const path: string[] = [];
  let current: string | null = end;

  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  return path.length > 0 && path[0] === start ? path : null;
}

/**
 * Build route object from path
 */
function buildRoute(
  path: string[],
  graph: Map<string, Edge[]>,
  incidentMap: Map<string, string[]>
): Route {
  let totalTime = 0;
  let hasIncident = false;
  const incidentTypes = new Set<string>();

  // Calculate total travel time
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const neighbors = graph.get(from) ?? [];
    const edge = neighbors.find((e) => e.toSegmentId === to);

    if (edge) {
      totalTime += edge.weight;
    }

    // Check for incidents
    if (incidentMap.has(to)) {
      hasIncident = true;
      const types = incidentMap.get(to) ?? [];
      types.forEach((t) => incidentTypes.add(t));
    }
  }

  return {
    segments: path,
    estimatedTravelTimeSeconds: Math.round(totalTime),
    affectedByIncident: hasIncident,
    incidentTypes: hasIncident ? Array.from(incidentTypes) : undefined,
  };
}
