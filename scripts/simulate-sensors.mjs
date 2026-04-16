/**
 * Sensor Simulator — Real-time Traffic Dashboard
 * Continuously POSTs traffic observations every 30 seconds
 * and renders a live terminal dashboard showing all segment states.
 */

const BASE_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
const INTERVAL_MS = 30_000;

// ANSI color helpers
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  bgRed:   "\x1b[41m",
  bgYellow:"\x1b[43m",
  bgGreen: "\x1b[42m",
  bgBlue:  "\x1b[44m",
};

const TIER_STYLE = {
  free:     { color: c.green,   bg: c.bgGreen,  icon: "🟢", label: "FREE    " },
  moderate: { color: c.yellow,  bg: c.bgYellow, icon: "🟡", label: "MODERATE" },
  heavy:    { color: c.red,     bg: "",         icon: "🔴", label: "HEAVY   " },
  gridlock: { color: c.bgRed,   bg: c.bgRed,    icon: "🚨", label: "GRIDLOCK" },
};

// Track history for change detection
const prevState = new Map();
const stats = { total: 0, errors: 0, cycles: 0, changes: 0 };

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function getCongestionTier(vehicleCount, avgSpeed) {
  if (avgSpeed >= 50) return "free";
  if (avgSpeed >= 30) return "moderate";
  if (avgSpeed >= 15) return "heavy";
  return "gridlock";
}

function speedBar(speed, maxSpeed = 70) {
  const filled = Math.round((speed / maxSpeed) * 12);
  const bar = "█".repeat(filled) + "░".repeat(12 - filled);
  return bar;
}

function vehicleBar(count, maxCount = 100) {
  const filled = Math.round((count / maxCount) * 12);
  const bar = "▓".repeat(filled) + "░".repeat(12 - filled);
  return bar;
}

async function getSegments() {
  const res = await fetch(`${BASE_URL}/api/monitoring/segments`);
  if (!res.ok) throw new Error(`Failed to fetch segments: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.segments ?? []);
}

function simulateReading(segmentName) {
  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour >= 23 || hour <= 5;

  const weights = isNight
    ? [70, 20, 8, 2]
    : isRushHour
    ? [5, 20, 45, 30]
    : [30, 40, 20, 10];

  const rand = Math.random() * 100;
  let tier;
  if (rand < weights[0]) tier = "free";
  else if (rand < weights[0] + weights[1]) tier = "moderate";
  else if (rand < weights[0] + weights[1] + weights[2]) tier = "heavy";
  else tier = "gridlock";

  if (segmentName?.includes("Prediction") && tier === "moderate") tier = "heavy";
  if (segmentName?.includes("Prediction") && tier === "free") tier = "moderate";

  let vehicleCount, avgSpeed;
  switch (tier) {
    case "free":
      vehicleCount = Math.floor(Math.random() * 18) + 1;
      avgSpeed     = Math.floor(Math.random() * 20) + 50;
      break;
    case "moderate":
      vehicleCount = Math.floor(Math.random() * 29) + 20;
      avgSpeed     = Math.floor(Math.random() * 20) + 30;
      break;
    case "heavy":
      vehicleCount = Math.floor(Math.random() * 29) + 50;
      avgSpeed     = Math.floor(Math.random() * 15) + 15;
      break;
    case "gridlock":
      vehicleCount = Math.floor(Math.random() * 20) + 80;
      avgSpeed     = Math.floor(Math.random() * 10) + 3;
      break;
  }

  return { vehicleCount, avgSpeedKmh: avgSpeed, tier };
}

async function pushObservation(segment) {
  const { vehicleCount, avgSpeedKmh, tier } = simulateReading(segment.name);

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

    stats.total++;
    const ok = res.ok;
    if (!ok) stats.errors++;

    const prev = prevState.get(segment.id);
    const changed = prev && prev.tier !== tier;
    if (changed) stats.changes++;

    prevState.set(segment.id, { tier, vehicleCount, avgSpeedKmh, ok, changed });
    return { segment, vehicleCount, avgSpeedKmh, tier, ok, changed };
  } catch (e) {
    stats.errors++;
    prevState.set(segment.id, { tier, vehicleCount, avgSpeedKmh, ok: false, changed: false, error: e.message });
    return { segment, vehicleCount, avgSpeedKmh, tier, ok: false, error: e.message };
  }
}

function renderDashboard(results, nextTick) {
  clearScreen();

  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const hour = now.getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour >= 23 || hour <= 5;
  const period = isNight ? "🌙 Night" : isRushHour ? "⚡ Rush Hour" : "☀️  Daytime";

  const width = 72;
  const line = "─".repeat(width);

  console.log(`${c.bold}${c.cyan}╔${"═".repeat(width)}╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║${c.reset}${c.bold}  🚦 STMS — Real-time Traffic Monitor${" ".repeat(width - 38)}${c.cyan}║${c.reset}`);
  console.log(`${c.bold}${c.cyan}║${c.reset}  ${c.dim}${dateStr}  ${timeStr}   ${period}${" ".repeat(width - 2 - dateStr.length - timeStr.length - period.length - 5)}${c.cyan}║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚${"═".repeat(width)}╝${c.reset}`);
  console.log();

  // Tier summary counts
  const tierCounts = { free: 0, moderate: 0, heavy: 0, gridlock: 0 };
  results.forEach(r => tierCounts[r.tier]++);

  console.log(`${c.bold}  NETWORK OVERVIEW${c.reset}  ${c.dim}Cycle #${stats.cycles}  |  ${stats.total} obs sent  |  ${stats.errors} errors  |  ${stats.changes} tier changes${c.reset}`);
  console.log(`  ${c.green}🟢 Free: ${tierCounts.free}${c.reset}   ${c.yellow}🟡 Moderate: ${tierCounts.moderate}${c.reset}   ${c.red}🔴 Heavy: ${tierCounts.heavy}${c.reset}   ${c.bgRed}${c.white}🚨 Gridlock: ${tierCounts.gridlock}${c.reset}`);
  console.log();

  // Column headers
  console.log(`${c.dim}  ${"SEGMENT".padEnd(28)} ${"STATUS".padEnd(10)} ${"VEHICLES".padEnd(16)} ${"SPEED (km/h)".padEnd(18)} CHG${c.reset}`);
  console.log(`  ${c.dim}${line}${c.reset}`);

  // Sort: gridlock first, then heavy, moderate, free
  const order = { gridlock: 0, heavy: 1, moderate: 2, free: 3 };
  const sorted = [...results].sort((a, b) => order[a.tier] - order[b.tier]);

  for (const r of sorted) {
    const style = TIER_STYLE[r.tier];
    const name = r.segment.name.length > 27 ? r.segment.name.slice(0, 24) + "..." : r.segment.name;
    const vBar = vehicleBar(r.vehicleCount);
    const sBar = speedBar(r.avgSpeedKmh);
    const chg = r.changed ? `${c.magenta}▲${c.reset}` : " ";
    const status = r.ok ? `${style.color}${style.label}${c.reset}` : `${c.red}ERROR   ${c.reset}`;
    const vCount = String(r.vehicleCount).padStart(3);
    const spd = String(r.avgSpeedKmh).padStart(3);

    console.log(
      `  ${style.icon} ${name.padEnd(27)} ${status} ` +
      `${c.dim}${vBar}${c.reset} ${vCount}v  ` +
      `${c.cyan}${sBar}${c.reset} ${spd}  ` +
      `${chg}`
    );
  }

  console.log(`\n  ${c.dim}${line}${c.reset}`);
  console.log(`  ${c.dim}Next update in ${c.reset}${c.bold}${c.cyan}${nextTick}s${c.reset}${c.dim}  |  Press Ctrl+C to stop${c.reset}`);
}

let countdown = INTERVAL_MS / 1000;
let countdownTimer = null;

async function runCycle(segments) {
  stats.cycles++;
  const results = await Promise.all(segments.map(pushObservation));

  countdown = INTERVAL_MS / 1000;
  renderDashboard(results, countdown);

  // Live countdown ticker
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      // Just update the last line in place
      process.stdout.write(`\x1b[1A\x1b[2K  ${c.dim}Next update in ${c.reset}${c.bold}${c.cyan}${countdown}s${c.reset}${c.dim}  |  Press Ctrl+C to stop${c.reset}\n`);
    }
  }, 1000);
}

async function main() {
  clearScreen();
  console.log(`${c.bold}${c.cyan}🚦 STMS Sensor Simulator starting...${c.reset}`);
  console.log(`   Target: ${c.cyan}${BASE_URL}${c.reset}`);
  console.log(`   Interval: ${INTERVAL_MS / 1000}s\n`);

  let segments = [];
  try {
    segments = await getSegments();
    console.log(`${c.green}✅ Found ${segments.length} segments${c.reset}\n`);
  } catch (e) {
    console.error(`${c.red}❌ Failed to load segments: ${e.message}${c.reset}`);
    process.exit(1);
  }

  await runCycle(segments);

  setInterval(async () => {
    try { segments = await getSegments(); } catch (_) {}
    await runCycle(segments);
  }, INTERVAL_MS);
}

main();
