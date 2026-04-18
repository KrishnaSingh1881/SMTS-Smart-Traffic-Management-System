/**
 * Meridian City seed — programmatic version usable from API routes.
 * Mirrors scripts/seed-meridian-city.mjs but as a TypeScript module.
 */

import { prisma } from "@/lib/db/prisma";
import { randomUUID } from "crypto";

const LAT = 18.5;
const LNG = 73.8;

function pt(dLat: number, dLng: number): [number, number] {
  return [
    parseFloat((LNG + dLng).toFixed(6)),
    parseFloat((LAT + dLat).toFixed(6)),
  ];
}

function lineString(coords: [number, number][]) {
  return JSON.stringify({ type: "LineString", coordinates: coords });
}

const SEGMENT_DEFS = [
  { name: "Central Boulevard",    zoneType: ["transit"],              floodRisk: false, speedLimitKmh: 60,  lengthMeters: 2200, geometry: lineString([pt(0.000,-0.020),pt(0.000,0.020)]),   currentCongestion: "Moderate" },
  { name: "North Ring Road",      zoneType: ["highway"],              floodRisk: false, speedLimitKmh: 100, lengthMeters: 4800, geometry: lineString([pt(0.040,-0.040),pt(0.040,0.040)]),   currentCongestion: "Free"     },
  { name: "Station Avenue",       zoneType: ["transit"],              floodRisk: false, speedLimitKmh: 50,  lengthMeters: 1100, geometry: lineString([pt(-0.010,-0.005),pt(0.010,-0.005)]), currentCongestion: "Moderate" },
  { name: "Market Street",        zoneType: ["commercial"],           floodRisk: false, speedLimitKmh: 50,  lengthMeters: 900,  geometry: lineString([pt(-0.008,0.005),pt(0.008,0.005)]),   currentCongestion: "Heavy"    },
  { name: "Harbour Link",         zoneType: ["commercial"],           floodRisk: true,  speedLimitKmh: 60,  lengthMeters: 1800, geometry: lineString([pt(-0.030,0.030),pt(-0.015,0.045)]),  currentCongestion: "Moderate" },
  { name: "Industrial Bypass",    zoneType: ["highway","industrial"], floodRisk: false, speedLimitKmh: 80,  lengthMeters: 3500, geometry: lineString([pt(0.020,-0.050),pt(0.020,-0.010)]),  currentCongestion: "Free"     },
  { name: "Airport Expressway",   zoneType: ["highway"],              floodRisk: false, speedLimitKmh: 120, lengthMeters: 5000, geometry: lineString([pt(0.050,-0.060),pt(0.050,0.010)]),   currentCongestion: "Free"     },
  { name: "University Road",      zoneType: ["residential"],          floodRisk: false, speedLimitKmh: 50,  lengthMeters: 1400, geometry: lineString([pt(0.015,0.010),pt(0.030,0.010)]),    currentCongestion: "Free"     },
  { name: "Old Town Lane",        zoneType: ["residential"],          floodRisk: false, speedLimitKmh: 40,  lengthMeters: 600,  geometry: lineString([pt(-0.005,-0.015),pt(0.005,-0.015)]), currentCongestion: "Free"     },
  { name: "Tech Park Drive",      zoneType: ["industrial"],           floodRisk: false, speedLimitKmh: 60,  lengthMeters: 2000, geometry: lineString([pt(0.025,-0.030),pt(0.025,-0.005)]),  currentCongestion: "Moderate" },
  { name: "Stadium Road",         zoneType: ["transit"],              floodRisk: false, speedLimitKmh: 60,  lengthMeters: 1600, geometry: lineString([pt(-0.020,0.010),pt(-0.005,0.010)]),  currentCongestion: "Heavy"    },
  { name: "Riverside Drive",      zoneType: ["transit"],              floodRisk: true,  speedLimitKmh: 50,  lengthMeters: 2400, geometry: lineString([pt(-0.035,0.020),pt(-0.020,0.035)]),  currentCongestion: "Moderate" },
  { name: "Commerce Way",         zoneType: ["commercial"],           floodRisk: false, speedLimitKmh: 50,  lengthMeters: 1200, geometry: lineString([pt(-0.012,0.015),pt(0.003,0.015)]),   currentCongestion: "Moderate" },
  { name: "Port Access Road",     zoneType: ["industrial"],           floodRisk: false, speedLimitKmh: 60,  lengthMeters: 2800, geometry: lineString([pt(-0.040,0.040),pt(-0.025,0.055)]),  currentCongestion: "Free"     },
  { name: "Eastern Connector",    zoneType: ["transit"],              floodRisk: false, speedLimitKmh: 70,  lengthMeters: 3200, geometry: lineString([pt(-0.010,0.030),pt(0.010,0.050)]),   currentCongestion: "Moderate" },
  { name: "Southern Loop",        zoneType: ["residential"],          floodRisk: false, speedLimitKmh: 50,  lengthMeters: 3800, geometry: lineString([pt(-0.045,-0.030),pt(-0.045,0.030)]), currentCongestion: "Free"     },
  { name: "Civic Centre Road",    zoneType: ["commercial"],           floodRisk: false, speedLimitKmh: 50,  lengthMeters: 1000, geometry: lineString([pt(0.005,-0.010),pt(0.005,0.010)]),   currentCongestion: "Moderate" },
  { name: "Waterfront Promenade", zoneType: ["commercial"],           floodRisk: true,  speedLimitKmh: 40,  lengthMeters: 1500, geometry: lineString([pt(-0.025,0.045),pt(-0.010,0.060)]),  currentCongestion: "Free"     },
];

const INTERSECTION_DEFS = [
  { name: "Central Square",        latitude: 18.5000, longitude: 73.8000, isHighPriority: true  },
  { name: "North Gate Junction",   latitude: 18.5400, longitude: 73.8000, isHighPriority: false },
  { name: "Station Crossroads",    latitude: 18.4950, longitude: 73.7950, isHighPriority: true  },
  { name: "Market Plaza",          latitude: 18.4960, longitude: 73.8050, isHighPriority: false },
  { name: "Harbour Roundabout",    latitude: 18.4700, longitude: 73.8300, isHighPriority: false },
  { name: "Industrial Gate",       latitude: 18.5200, longitude: 73.7500, isHighPriority: false },
  { name: "Airport Terminal Node", latitude: 18.5500, longitude: 73.7400, isHighPriority: false },
  { name: "University Circle",     latitude: 18.5150, longitude: 73.8100, isHighPriority: false },
  { name: "Stadium Approach",      latitude: 18.4800, longitude: 73.8100, isHighPriority: true  },
  { name: "Tech Park Entrance",    latitude: 18.5250, longitude: 73.7700, isHighPriority: false },
  { name: "Civic Centre Hub",      latitude: 18.5050, longitude: 73.7900, isHighPriority: true  },
];

export async function seedMeridianCity() {
  console.log("[seed] Seeding Meridian City...");

  // Clear existing data
  await prisma.routeEdge.deleteMany();
  await prisma.congestionPrediction.deleteMany();
  await prisma.trafficObservation.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.signalPhase.deleteMany();
  await prisma.trafficSignal.deleteMany();
  await prisma.intersectionSegment.deleteMany();
  await prisma.intersection.deleteMany();
  await prisma.roadSegment.deleteMany();

  // Create segments
  const segments: Array<{ id: string; name: string; lengthMeters: number; speedLimitKmh: number }> = [];
  for (const def of SEGMENT_DEFS) {
    const seg = await prisma.roadSegment.create({
      data: {
        id: randomUUID(),
        name: def.name,
        geometry: def.geometry,
        lengthMeters: def.lengthMeters,
        speedLimitKmh: def.speedLimitKmh,
        currentCongestion: def.currentCongestion as "Free" | "Moderate" | "Heavy" | "Gridlock",
        zoneType: def.zoneType,
        floodRisk: def.floodRisk,
        sensorOnline: true,
      },
    });
    segments.push(seg);
  }
  const segByName = Object.fromEntries(segments.map((s) => [s.name, s]));

  // Create intersections
  const intersections: Array<{ id: string; name: string }> = [];
  for (const def of INTERSECTION_DEFS) {
    const ix = await prisma.intersection.create({
      data: { id: randomUUID(), ...def },
    });
    intersections.push(ix);
  }
  const ixByName = Object.fromEntries(intersections.map((i) => [i.name, i]));

  // Link segments to intersections
  const links: [string, string][] = [
    ["Central Boulevard","Central Square"],["Central Boulevard","Civic Centre Hub"],
    ["North Ring Road","North Gate Junction"],["North Ring Road","Industrial Gate"],
    ["Station Avenue","Station Crossroads"],["Station Avenue","Central Square"],
    ["Market Street","Market Plaza"],["Market Street","Central Square"],
    ["Harbour Link","Harbour Roundabout"],["Industrial Bypass","Industrial Gate"],
    ["Industrial Bypass","Tech Park Entrance"],["Airport Expressway","Airport Terminal Node"],
    ["Airport Expressway","Industrial Gate"],["University Road","University Circle"],
    ["University Road","North Gate Junction"],["Old Town Lane","Station Crossroads"],
    ["Tech Park Drive","Tech Park Entrance"],["Stadium Road","Stadium Approach"],
    ["Stadium Road","Market Plaza"],["Riverside Drive","Harbour Roundabout"],
    ["Riverside Drive","Stadium Approach"],["Commerce Way","Market Plaza"],
    ["Commerce Way","Civic Centre Hub"],["Port Access Road","Harbour Roundabout"],
    ["Eastern Connector","Market Plaza"],["Eastern Connector","University Circle"],
    ["Southern Loop","Stadium Approach"],["Southern Loop","Harbour Roundabout"],
    ["Civic Centre Road","Civic Centre Hub"],["Civic Centre Road","Central Square"],
    ["Waterfront Promenade","Harbour Roundabout"],
  ];
  for (const [segName, ixName] of links) {
    await prisma.intersectionSegment.create({
      data: { intersectionId: ixByName[ixName].id, segmentId: segByName[segName].id },
    });
  }

  // Create 4 traffic signals
  const signalDefs = [
    { ix: "Central Square",    label: "Central Square Signal",    phase: "Green"  },
    { ix: "Station Crossroads",label: "Station Crossroads Signal", phase: "Red"    },
    { ix: "Market Plaza",      label: "Market Plaza Signal",       phase: "Yellow" },
    { ix: "Stadium Approach",  label: "Stadium Approach Signal",   phase: "Red"    },
  ];
  for (const def of signalDefs) {
    await prisma.trafficSignal.create({
      data: {
        id: randomUUID(),
        intersectionId: ixByName[def.ix].id,
        label: def.label,
        currentPhase: def.phase as "Green" | "Yellow" | "Red" | "Off",
        isOnline: true,
        overrideActive: false,
        aiOptimized: true,
      },
    });
  }

  // Create 2 active incidents
  await prisma.incident.create({
    data: {
      id: randomUUID(),
      segmentId: segByName["Market Street"].id,
      type: "Accident",
      status: "Active",
      severity: 3,
      description: "Multi-vehicle collision blocking two lanes near Market Plaza.",
    },
  });
  await prisma.incident.create({
    data: {
      id: randomUUID(),
      segmentId: segByName["Stadium Road"].id,
      type: "Road_Closure",
      status: "Active",
      severity: 2,
      description: "Temporary road closure for post-match crowd management.",
    },
  });

  // Create congestion predictions
  const predLevels = ["Free","Free","Moderate","Heavy","Moderate","Free","Free","Free","Free","Moderate","Gridlock","Moderate","Moderate","Free","Moderate","Free","Moderate","Free"];
  for (let i = 0; i < segments.length; i++) {
    await prisma.congestionPrediction.create({
      data: { id: randomUUID(), segmentId: segments[i].id, predictedLevel: predLevels[i] as "Free"|"Moderate"|"Heavy"|"Gridlock", targetWindowMinutes: 60, modelConfidenceScore: 0.75 + Math.random() * 0.2 },
    });
    await prisma.congestionPrediction.create({
      data: { id: randomUUID(), segmentId: segments[i].id, predictedLevel: predLevels[(i+2)%predLevels.length] as "Free"|"Moderate"|"Heavy"|"Gridlock", targetWindowMinutes: 120, modelConfidenceScore: 0.65 + Math.random() * 0.25 },
    });
  }

  // Create route edges
  const edgePairs: [string, string][] = [
    ["Central Boulevard","Station Avenue"],["Central Boulevard","Market Street"],
    ["Central Boulevard","Civic Centre Road"],["Station Avenue","Old Town Lane"],
    ["Station Avenue","Civic Centre Road"],["Market Street","Commerce Way"],
    ["Market Street","Stadium Road"],["Market Street","Eastern Connector"],
    ["Harbour Link","Riverside Drive"],["Harbour Link","Port Access Road"],
    ["Harbour Link","Waterfront Promenade"],["Industrial Bypass","North Ring Road"],
    ["Industrial Bypass","Tech Park Drive"],["Industrial Bypass","Airport Expressway"],
    ["Airport Expressway","North Ring Road"],["University Road","North Ring Road"],
    ["University Road","Eastern Connector"],["Stadium Road","Riverside Drive"],
    ["Stadium Road","Southern Loop"],["Commerce Way","Civic Centre Road"],
    ["Eastern Connector","University Road"],["Southern Loop","Riverside Drive"],
    ["Tech Park Drive","Industrial Bypass"],["Port Access Road","Waterfront Promenade"],
    ["Civic Centre Road","Central Boulevard"],
  ];
  for (const [fromName, toName] of edgePairs) {
    const from = segByName[fromName];
    const to = segByName[toName];
    const t1 = Math.round(from.lengthMeters / (from.speedLimitKmh / 3.6));
    const t2 = Math.round(to.lengthMeters / (to.speedLimitKmh / 3.6));
    await prisma.routeEdge.create({ data: { id: randomUUID(), fromSegmentId: from.id, toSegmentId: to.id, baseTravelTime: t1 } });
    await prisma.routeEdge.create({ data: { id: randomUUID(), fromSegmentId: to.id, toSegmentId: from.id, baseTravelTime: t2 } });
  }

  console.log("[seed] Meridian City seeded successfully.");
}
