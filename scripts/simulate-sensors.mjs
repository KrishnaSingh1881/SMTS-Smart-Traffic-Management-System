/**
 * Sensor Simulator
 * Continuously POSTs traffic observations to keep all segments "online"
 * and simulates realistic congestion changes throughout the day.
 */

const BASE_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3001";
const INTERVAL_MS = 30_000; // every 30 seconds per segment

async function getSegments() {
  const res = await fetch(`${BASE_URL}/api/monitoring/segments`);
  if (!res.ok) throw new Error(`Failed to fetch segments: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.segments ?? []);
}

function simulateReading(segmentName) {
  const hour = new Date().getHours();

  // Rush hours: 7-9am and 5-7pm
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour >= 23 || hour <= 5;

  // Pick a random congestion tier weighted by time of day
  // Weights: [Free, Moderate, Heavy, Gridlock]
  const weights = isNight
    ? [70, 20, 8, 2]       // mostly free at night
    : isRushHour
    ? [5, 20, 45, 30]      // heavy/gridlock during rush hour
    : [30, 40, 20, 10];    // mixed during day

  const rand = Math.random() * 100;
  let tier;
  if (rand < weights[0]) tier = "free";
  else if (rand < weights[0] + weights[1]) tier = "moderate";
  else if (rand < weights[0] + weights[1] + weights[2]) tier = "heavy";
  else tier = "gridlock";

  // Prediction segments skew one tier worse
  if (segmentName?.includes("Prediction") && tier === "moderate") tier = "heavy";
  if (segmentName?.includes("Prediction") && tier === "free") tier = "moderate";

  let vehicleCount, avgSpeed;
  switch (tier) {
    case "free":
      vehicleCount = Math.floor(Math.random() * 18) + 1;   // 1–18
      avgSpeed     = Math.floor(Math.random() * 20) + 50;  // 50–70
      break;
    case "moderate":
      vehicleCount = Math.floor(Math.random() * 29) + 20;  // 20–48
      avgSpeed     = Math.floor(Math.random() * 20) + 30;  // 30–49
      break;
    case "heavy":
      vehicleCount = Math.floor(Math.random() * 29) + 50;  // 50–78
      avgSpeed     = Math.floor(Math.random() * 15) + 15;  // 15–29
      break;
    case "gridlock":
      vehicleCount = Math.floor(Math.random() * 20) + 80;  // 80–100
      avgSpeed     = Math.floor(Math.random() * 10) + 3;   // 3–12
      break;
  }

  return { vehicleCount, avgSpeedKmh: avgSpeed };
}

async function pushObservation(segment) {
  const { vehicleCount, avgSpeedKmh } = simulateReading(segment.name);

  try {
    const res = await fetch(`${BASE_URL}/api/monitoring/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment_id: segment.id,
        vehicle_count: vehicleCount,
        avg_speed_kmh: avgSpeedKmh,
      }),
    });

    if (res.ok) {
      console.log(`✅ ${segment.name.padEnd(30)} | vehicles: ${String(vehicleCount).padStart(3)} | speed: ${avgSpeedKmh} km/h`);
    } else {
      const err = await res.text();
      console.error(`❌ ${segment.name}: ${res.status} — ${err}`);
    }
  } catch (e) {
    console.error(`❌ ${segment.name}: ${e.message}`);
  }
}

async function runCycle(segments) {
  console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Pushing observations for ${segments.length} segments...`);
  await Promise.all(segments.map(pushObservation));
}

async function main() {
  console.log(`🚦 STMS Sensor Simulator`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Interval: ${INTERVAL_MS / 1000}s\n`);

  let segments = [];

  try {
    segments = await getSegments();
    console.log(`📡 Found ${segments.length} segments\n`);
  } catch (e) {
    console.error("Failed to load segments:", e.message);
    process.exit(1);
  }

  // Run immediately, then on interval
  await runCycle(segments);

  setInterval(async () => {
    // Refresh segment list in case new ones were added
    try {
      segments = await getSegments();
    } catch (_) { /* keep using old list */ }
    await runCycle(segments);
  }, INTERVAL_MS);
}

main();
