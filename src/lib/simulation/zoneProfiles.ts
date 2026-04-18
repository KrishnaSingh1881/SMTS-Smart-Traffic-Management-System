/**
 * Zone profile functions for the STMS Simulation Engine.
 *
 * Each zone type has a time-of-day traffic pattern. These functions return
 * BASE values (before variance). The engine applies ±15% variance on top.
 *
 * Congestion thresholds (consistent with compute_congestion_level stored procedure):
 *   Free:     vehicleCount < 20
 *   Moderate: vehicleCount 20–49
 *   Heavy:    vehicleCount 50–79
 *   Gridlock: vehicleCount ≥ 80
 */

export type ZoneType = 'residential' | 'commercial' | 'industrial' | 'transit' | 'highway'

export interface ZoneOutput {
  vehicleCount: number
  avgSpeedKmh: number
}

/**
 * Returns the tick interval in milliseconds for a given speed multiplier.
 * At 1x speed, one tick fires every 30 seconds.
 */
export function getTickIntervalMs(speed: number): number {
  return 30000 / speed
}

/**
 * Returns base vehicle count and average speed for a residential zone at the given hour.
 *
 * Pattern (Req 7.1):
 *   - Peak:  07:00–09:00 and 17:00–19:00 → Heavy (50–79)
 *   - Quiet: 22:00–06:00                 → Free  (<20)
 *   - Other: moderate daytime activity   → Moderate (20–49)
 */
function residentialProfile(hour: number): ZoneOutput {
  // Morning peak: 07–09
  if (hour >= 7 && hour < 9) {
    return { vehicleCount: 62, avgSpeedKmh: 35 }
  }
  // Evening peak: 17–19
  if (hour >= 17 && hour < 19) {
    return { vehicleCount: 65, avgSpeedKmh: 33 }
  }
  // Night quiet: 22–06 (wraps midnight)
  if (hour >= 22 || hour < 6) {
    return { vehicleCount: 8, avgSpeedKmh: 60 }
  }
  // Shoulder hours: moderate
  return { vehicleCount: 30, avgSpeedKmh: 50 }
}

/**
 * Returns base vehicle count and average speed for a commercial zone at the given hour.
 *
 * Pattern (Req 7.2):
 *   - Peak:     11:00–13:00 and 16:00–19:00 → Heavy (50–79)
 *   - Moderate: other daytime hours          → Moderate (20–49)
 *   - Night:    22:00–07:00                  → Free (<20)
 */
function commercialProfile(hour: number): ZoneOutput {
  // Lunch peak: 11–13
  if (hour >= 11 && hour < 13) {
    return { vehicleCount: 58, avgSpeedKmh: 38 }
  }
  // Afternoon/evening peak: 16–19
  if (hour >= 16 && hour < 19) {
    return { vehicleCount: 60, avgSpeedKmh: 36 }
  }
  // Night: 22–07
  if (hour >= 22 || hour < 7) {
    return { vehicleCount: 10, avgSpeedKmh: 58 }
  }
  // Other daytime: moderate
  return { vehicleCount: 35, avgSpeedKmh: 48 }
}

/**
 * Returns base vehicle count and average speed for an industrial zone at the given hour.
 *
 * Pattern (Req 7.3):
 *   - Steady moderate: 06:00–18:00 → Moderate (20–49)
 *   - Low:             otherwise   → Free (<20)
 */
function industrialProfile(hour: number): ZoneOutput {
  if (hour >= 6 && hour < 18) {
    return { vehicleCount: 38, avgSpeedKmh: 45 }
  }
  return { vehicleCount: 12, avgSpeedKmh: 55 }
}

/**
 * Returns base vehicle count and average speed for a transit zone at the given hour.
 *
 * Pattern (Req 7.4):
 *   - High load during all peak hours (07–09, 11–13, 16–19) → Heavy (50–79)
 *   - Moderate off-peak daytime                              → Moderate (20–49)
 *   - Night: 22:00–06:00                                     → Free (<20)
 */
function transitProfile(hour: number): ZoneOutput {
  // All peak windows
  if ((hour >= 7 && hour < 9) || (hour >= 11 && hour < 13) || (hour >= 16 && hour < 19)) {
    return { vehicleCount: 70, avgSpeedKmh: 30 }
  }
  // Night
  if (hour >= 22 || hour < 6) {
    return { vehicleCount: 15, avgSpeedKmh: 55 }
  }
  // Off-peak daytime
  return { vehicleCount: 40, avgSpeedKmh: 42 }
}

/**
 * Returns base vehicle count and average speed for a highway zone at the given hour.
 *
 * Pattern (Req 7.5):
 *   - Mirrors residential peak pattern but with higher base vehicle counts.
 *   - Peak:  07:00–09:00 and 17:00–19:00 → Gridlock-adjacent Heavy (70–79)
 *   - Quiet: 22:00–06:00                 → Moderate (20–49) — higher base than residential
 *   - Other: moderate-heavy              → Moderate-Heavy (40–55)
 */
function highwayProfile(hour: number): ZoneOutput {
  // Morning peak: 07–09
  if (hour >= 7 && hour < 9) {
    return { vehicleCount: 75, avgSpeedKmh: 70 }
  }
  // Evening peak: 17–19
  if (hour >= 17 && hour < 19) {
    return { vehicleCount: 72, avgSpeedKmh: 72 }
  }
  // Night quiet: 22–06 — still higher base than residential
  if (hour >= 22 || hour < 6) {
    return { vehicleCount: 22, avgSpeedKmh: 110 }
  }
  // Shoulder hours
  return { vehicleCount: 48, avgSpeedKmh: 90 }
}

/**
 * Returns the base vehicle count and average speed for a given zone type at a given hour.
 *
 * @param hour - Simulated hour of day (0–23)
 * @param zone - Zone classification of the road segment
 * @returns Base ZoneOutput (no variance applied)
 */
export function getZoneProfile(hour: number, zone: ZoneType): ZoneOutput {
  switch (zone) {
    case 'residential':
      return residentialProfile(hour)
    case 'commercial':
      return commercialProfile(hour)
    case 'industrial':
      return industrialProfile(hour)
    case 'transit':
      return transitProfile(hour)
    case 'highway':
      return highwayProfile(hour)
  }
}
