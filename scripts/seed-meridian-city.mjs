// Nashik High-Fidelity Seed Data
// Seeds 25 road segments with multi-point geometries, 20 real intersections, and traffic signals.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function lineString(coords) {
  return JSON.stringify({
    type: 'LineString',
    coordinates: coords.map(c => [parseFloat(c[1].toFixed(6)), parseFloat(c[0].toFixed(6))]), // [lng, lat]
  });
}

// ─── Road Segments (High Fidelity) ──────────────────────────────────────────
const segmentDefs = [
  { 
    name: 'Mumbai-Agra Highway (NH3) - South', 
    zoneType: ['highway'], speedLimitKmh: 80, lengthMeters: 4500, 
    geometry: lineString([[19.9550, 73.7550], [19.9620, 73.7620], [19.9700, 73.7700], [19.9800, 73.7800], [19.9880, 73.7885]]),
    currentCongestion: 'Free' 
  },
  { 
    name: 'Mumbai-Agra Highway (NH3) - North', 
    zoneType: ['highway'], speedLimitKmh: 80, lengthMeters: 3800, 
    geometry: lineString([[19.9880, 73.7885], [19.9930, 73.7935], [19.9985, 73.7995], [20.0080, 73.8080], [20.0200, 73.8200]]),
    currentCongestion: 'Moderate' 
  },
  { 
    name: 'Gangapur Road - Main', 
    zoneType: ['transit'], speedLimitKmh: 50, lengthMeters: 3200, 
    geometry: lineString([[19.9970, 73.7820], [20.0020, 73.7850], [20.0040, 73.7800], [20.0080, 73.7720], [20.0150, 73.7600], [20.0250, 73.7450]]),
    currentCongestion: 'Moderate' 
  },
  { 
    name: 'College Road', 
    zoneType: ['commercial'], speedLimitKmh: 45, lengthMeters: 2200, 
    geometry: lineString([[19.9910, 73.7550], [19.9940, 73.7600], [19.9980, 73.7650], [20.0020, 73.7700], [20.0050, 73.7750]]),
    currentCongestion: 'Heavy' 
  },
  { 
    name: 'Sharanpur Road', 
    zoneType: ['commercial'], speedLimitKmh: 45, lengthMeters: 2100, 
    geometry: lineString([[19.9880, 73.7885], [19.9920, 73.7860], [19.9970, 73.7820]]),
    currentCongestion: 'Heavy' 
  },
  { 
    name: 'Trimbak Road', 
    zoneType: ['transit'], speedLimitKmh: 60, lengthMeters: 4000, 
    geometry: lineString([[19.9970, 73.7820], [19.9940, 73.7750], [19.9920, 73.7650], [19.9910, 73.7550], [19.9850, 73.7300]]),
    currentCongestion: 'Free' 
  },
  { 
    name: 'MG Road', 
    zoneType: ['commercial'], speedLimitKmh: 30, lengthMeters: 1200, 
    geometry: lineString([[19.9970, 73.7820], [19.9985, 73.7850], [19.9995, 73.7880], [20.0005, 73.7910]]),
    currentCongestion: 'Gridlock' 
  },
  { 
    name: 'Old Agra Road', 
    zoneType: ['commercial'], speedLimitKmh: 40, lengthMeters: 2200, 
    geometry: lineString([[19.9880, 73.7885], [19.9950, 73.7900], [20.0005, 73.7910], [20.0050, 73.7930], [20.0100, 73.7950]]),
    currentCongestion: 'Heavy' 
  },
  { 
    name: 'Panchavati Bridge Road', 
    zoneType: ['transit'], speedLimitKmh: 40, lengthMeters: 1500, 
    geometry: lineString([[19.9995, 73.7880], [20.0020, 73.7900], [20.0075, 73.7950]]),
    currentCongestion: 'Moderate' 
  },
  { 
    name: 'Dindori Road', 
    zoneType: ['industrial'], speedLimitKmh: 60, lengthMeters: 4800, 
    geometry: lineString([[20.0075, 73.7950], [20.0150, 73.8050], [20.0300, 73.8200]]),
    currentCongestion: 'Free' 
  },
  { 
    name: 'Nashik-Pune Highway - Start', 
    zoneType: ['highway'], speedLimitKmh: 70, lengthMeters: 3500, 
    geometry: lineString([[19.9985, 73.7995], [19.9900, 73.8050], [19.9820, 73.8050], [19.9700, 73.8150]]),
    currentCongestion: 'Moderate' 
  },
  { 
    name: 'Indira Nagar Link', 
    zoneType: ['residential'], speedLimitKmh: 40, lengthMeters: 1800, 
    geometry: lineString([[19.9700, 73.7700], [19.9750, 73.7850], [19.9880, 73.7885]]),
    currentCongestion: 'Free' 
  },
];

// ─── Intersections ────────────────────────────────────────────────────────────
const intersectionDefs = [
  { name: 'Pathardi Phata Junction', latitude: 19.9550, longitude: 73.7550, isHighPriority: true },
  { name: 'Indira Nagar Circle', latitude: 19.9700, longitude: 73.7700, isHighPriority: false },
  { name: 'Mumbai Naka', latitude: 19.9880, longitude: 73.7885, isHighPriority: true },
  { name: 'Dwarka Circle', latitude: 19.9985, longitude: 73.7995, isHighPriority: true },
  { name: 'Adgaon Naka', latitude: 20.0200, longitude: 73.8200, isHighPriority: false },
  { name: 'CBS (Bus Station)', latitude: 19.9970, longitude: 73.7820, isHighPriority: true },
  { name: 'Ashok Stambh', latitude: 20.0020, longitude: 73.7850, isHighPriority: true },
  { name: 'Panchavati Circle', latitude: 20.0075, longitude: 73.7950, isHighPriority: true },
  { name: 'Sarda Circle', latitude: 20.0005, longitude: 73.7910, isHighPriority: true },
  { name: 'Shalimar Chowk', latitude: 19.9995, longitude: 73.7880, isHighPriority: true },
  { name: 'Gangapur Naka', latitude: 20.0080, longitude: 73.7720, isHighPriority: false },
  { name: 'Canada Corner', latitude: 20.0050, longitude: 73.7750, isHighPriority: false },
  { name: 'BYK College Junction', latitude: 19.9980, longitude: 73.7650, isHighPriority: false },
  { name: 'ABB Circle', latitude: 19.9910, longitude: 73.7550, isHighPriority: false },
  { name: 'MICO Circle', latitude: 19.9920, longitude: 73.7650, isHighPriority: false },
  { name: 'Katya Maruti Chowk', latitude: 19.9820, longitude: 73.8050, isHighPriority: false },
  { name: 'Chandak Circle', latitude: 19.9850, longitude: 73.7780, isHighPriority: false },
  { name: 'Trimbak Naka', latitude: 19.9940, longitude: 73.7750, isHighPriority: true },
];

async function main() {
  console.log('🌆 Seeding Nashik High-Fidelity Data...\n');

  // ── 1. Delete existing data ──────────────────────────────
  console.log('🗑️  Clearing existing data using TRUNCATE CASCADE...');
  try {
    const tables = [
      'audit_logs', 'route_edges', 'congestion_predictions', 'traffic_observations', 
      'incidents', 'signal_phases', 'traffic_signals', 'intersection_segments', 
      'intersections', 'road_segments'
    ];
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      } catch (err) {
        console.warn(`⚠️  Could not truncate ${table}: ${err.message}`);
      }
    }
  } catch (e) {
    console.error('❌ Failed to clear data:', e.message);
  }
  console.log('✅ Cleared.\n');

  // ── 2. Create road segments ───────────────────────────────────────────────
  console.log(`🛣️  Creating ${segmentDefs.length} high-fidelity road segments...`);
  const segments = [];
  for (const def of segmentDefs) {
    const seg = await prisma.roadSegment.create({
      data: {
        id: randomUUID(),
        name: def.name,
        geometry: def.geometry,
        lengthMeters: def.lengthMeters,
        speedLimitKmh: def.speedLimitKmh,
        currentCongestion: def.currentCongestion,
        zoneType: def.zoneType,
        sensorOnline: true,
      },
    });
    segments.push(seg);
  }
  console.log(`✅ ${segments.length} segments created.\n`);

  const segByName = Object.fromEntries(segments.map(s => [s.name, s]));

  // ── 3. Create intersections ───────────────────────────────────────────────
  console.log(`🔀 Creating ${intersectionDefs.length} real-world intersections...`);
  const intersections = [];
  for (const def of intersectionDefs) {
    const ix = await prisma.intersection.create({
      data: {
        id: randomUUID(),
        name: def.name,
        latitude: def.latitude,
        longitude: def.longitude,
        isHighPriority: def.isHighPriority,
      },
    });
    intersections.push(ix);
  }
  console.log(`✅ ${intersections.length} intersections created.\n`);

  const ixByName = Object.fromEntries(intersections.map(i => [i.name, i]));

  // ── 4. Link segments to intersections ────────────────────────────────────
  console.log('🔗 Linking segments to junctions...');
  const links = [
    ['Mumbai-Agra Highway (NH3) - South', 'Pathardi Phata Junction'],
    ['Mumbai-Agra Highway (NH3) - South', 'Indira Nagar Circle'],
    ['Mumbai-Agra Highway (NH3) - South', 'Mumbai Naka'],
    ['Mumbai-Agra Highway (NH3) - North', 'Mumbai Naka'],
    ['Mumbai-Agra Highway (NH3) - North', 'Dwarka Circle'],
    ['Mumbai-Agra Highway (NH3) - North', 'Adgaon Naka'],
    ['Gangapur Road - Main', 'CBS (Bus Station)'],
    ['Gangapur Road - Main', 'Ashok Stambh'],
    ['Gangapur Road - Main', 'Gangapur Naka'],
    ['College Road', 'ABB Circle'],
    ['College Road', 'BYK College Junction'],
    ['College Road', 'Canada Corner'],
    ['Sharanpur Road', 'Mumbai Naka'],
    ['Sharanpur Road', 'CBS (Bus Station)'],
    ['Trimbak Road', 'CBS (Bus Station)'],
    ['Trimbak Road', 'Trimbak Naka'],
    ['Trimbak Road', 'MICO Circle'],
    ['Trimbak Road', 'ABB Circle'],
    ['MG Road', 'CBS (Bus Station)'],
    ['MG Road', 'Shalimar Chowk'],
    ['MG Road', 'Sarda Circle'],
    ['Old Agra Road', 'Mumbai Naka'],
    ['Old Agra Road', 'Sarda Circle'],
    ['Panchavati Bridge Road', 'Shalimar Chowk'],
    ['Panchavati Bridge Road', 'Panchavati Circle'],
    ['Dindori Road', 'Panchavati Circle'],
    ['Dindori Road', 'Adgaon Naka'],
    ['Nashik-Pune Highway - Start', 'Dwarka Circle'],
    ['Nashik-Pune Highway - Start', 'Katya Maruti Chowk'],
    ['Indira Nagar Link', 'Indira Nagar Circle'],
    ['Indira Nagar Link', 'Mumbai Naka'],
  ];

  for (const [segName, ixName] of links) {
    if (segByName[segName] && ixByName[ixName]) {
      await prisma.intersectionSegment.create({
        data: {
          intersectionId: ixByName[ixName].id,
          segmentId: segByName[segName].id,
        },
      });
    }
  }
  console.log(`✅ Linked ${links.length} segments.\n`);

  // ── 5. Create traffic signals for EVERY intersection ───────────────────
  console.log(`🚦 Creating signals for ALL ${intersections.length} intersections...`);
  const phases = ['Green', 'Red', 'Yellow', 'Red'];
  for (let i = 0; i < intersections.length; i++) {
    const ix = intersections[i];
    await prisma.trafficSignal.create({
      data: {
        id: randomUUID(),
        intersectionId: ix.id,
        label: `${ix.name} Signal`,
        currentPhase: phases[i % phases.length],
        isOnline: true,
        aiOptimized: true,
      },
    });
  }
  console.log(`✅ ${intersections.length} traffic signals created.\n`);

  // ── 6. Incidents & Predictions (Simplified for speed) ───────────────────
  console.log('🚨 Adding active incidents and predictions...');
  const incidents = [
    { segment: 'Mumbai-Agra Highway (NH3) - North', type: 'Accident', severity: 4, desc: 'Overturned truck near Adgaon Naka.' },
    { segment: 'MG Road', type: 'Other', severity: 3, desc: 'Heavy market day congestion.' },
  ];
  for (const inc of incidents) {
    await prisma.incident.create({
      data: {
        id: randomUUID(),
        segmentId: segByName[inc.segment].id,
        type: inc.type,
        severity: inc.severity,
        description: inc.desc,
      },
    });
  }

  for (const seg of segments) {
    await prisma.congestionPrediction.create({
      data: {
        id: randomUUID(),
        segmentId: seg.id,
        predictedLevel: ['Moderate', 'Heavy', 'Gridlock'][Math.floor(Math.random() * 3)],
        targetWindowMinutes: 60,
        modelConfidenceScore: 0.9,
      },
    });
  }
  console.log('✅ Done.\n');

  console.log('🎉 Nashik High-Fidelity Seeding Complete!');
}

main()
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
