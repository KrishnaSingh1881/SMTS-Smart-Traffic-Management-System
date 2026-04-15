import type { CongestionLevel } from "@prisma/client";

/**
 * Compute congestion level from vehicle count and average speed.
 *
 * Tiers (deterministic, priority order):
 *   Gridlock  : vehicleCount >= 80 OR avgSpeedKmh < 15
 *   Heavy     : vehicleCount >= 50 OR avgSpeedKmh < 30  (and not Gridlock)
 *   Moderate  : vehicleCount >= 20 OR avgSpeedKmh < 50  (and not Heavy/Gridlock)
 *   Free      : vehicleCount < 20  AND avgSpeedKmh >= 50
 */
export function computeCongestionLevel(
  vehicleCount: number,
  avgSpeedKmh: number
): CongestionLevel {
  if (vehicleCount >= 80 || avgSpeedKmh < 15) return "Gridlock";
  if (vehicleCount >= 50 || avgSpeedKmh < 30) return "Heavy";
  if (vehicleCount >= 20 || avgSpeedKmh < 50) return "Moderate";
  return "Free";
}
