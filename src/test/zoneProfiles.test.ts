/**
 * Unit tests for zoneProfiles.ts
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest'
import { getZoneProfile } from '@/lib/simulation/zoneProfiles'

describe('getZoneProfile', () => {
  // ── Sanity: all outputs must be non-negative ──────────────────────────────
  it('all zone/hour combinations return non-negative vehicleCount and avgSpeedKmh', () => {
    const zones = ['residential', 'commercial', 'industrial', 'transit', 'highway'] as const
    for (let hour = 0; hour < 24; hour++) {
      for (const zone of zones) {
        const out = getZoneProfile(hour, zone)
        expect(out.vehicleCount, `${zone} @ ${hour}h vehicleCount`).toBeGreaterThanOrEqual(0)
        expect(out.avgSpeedKmh, `${zone} @ ${hour}h avgSpeedKmh`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  // ── Residential (Req 7.1) ─────────────────────────────────────────────────
  describe('residential', () => {
    it('morning peak (08:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(8, 'residential')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('evening peak (18:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(18, 'residential')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('night quiet (03:00) is in Free range (<20)', () => {
      const out = getZoneProfile(3, 'residential')
      expect(out.vehicleCount).toBeLessThan(20)
    })

    it('residential at 03:00 does NOT produce Gridlock-level vehicle counts (≥80)', () => {
      const out = getZoneProfile(3, 'residential')
      expect(out.vehicleCount).toBeLessThan(80)
    })

    it('off-peak daytime (10:00) is in Moderate range (20–49)', () => {
      const out = getZoneProfile(10, 'residential')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
      expect(out.vehicleCount).toBeLessThanOrEqual(49)
    })
  })

  // ── Commercial (Req 7.2) ──────────────────────────────────────────────────
  describe('commercial', () => {
    it('lunch peak (12:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(12, 'commercial')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('afternoon peak (17:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(17, 'commercial')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('night (02:00) is in Free range (<20)', () => {
      const out = getZoneProfile(2, 'commercial')
      expect(out.vehicleCount).toBeLessThan(20)
    })

    it('off-peak daytime (09:00) is in Moderate range (20–49)', () => {
      const out = getZoneProfile(9, 'commercial')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
      expect(out.vehicleCount).toBeLessThanOrEqual(49)
    })
  })

  // ── Industrial (Req 7.3) ──────────────────────────────────────────────────
  describe('industrial', () => {
    it('working hours (10:00) is in Moderate range (20–49)', () => {
      const out = getZoneProfile(10, 'industrial')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
      expect(out.vehicleCount).toBeLessThanOrEqual(49)
    })

    it('working hours (14:00) is in Moderate range (20–49)', () => {
      const out = getZoneProfile(14, 'industrial')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
      expect(out.vehicleCount).toBeLessThanOrEqual(49)
    })

    it('night (23:00) is in Free range (<20)', () => {
      const out = getZoneProfile(23, 'industrial')
      expect(out.vehicleCount).toBeLessThan(20)
    })

    it('early morning (04:00) is in Free range (<20)', () => {
      const out = getZoneProfile(4, 'industrial')
      expect(out.vehicleCount).toBeLessThan(20)
    })
  })

  // ── Transit (Req 7.4) ─────────────────────────────────────────────────────
  describe('transit', () => {
    it('morning peak (07:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(7, 'transit')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('midday peak (11:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(11, 'transit')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('evening peak (16:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(16, 'transit')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('night (01:00) is in Free range (<20)', () => {
      const out = getZoneProfile(1, 'transit')
      expect(out.vehicleCount).toBeLessThan(20)
    })

    it('off-peak daytime (14:00) is in Moderate range (20–49)', () => {
      const out = getZoneProfile(14, 'transit')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
      expect(out.vehicleCount).toBeLessThanOrEqual(49)
    })
  })

  // ── Highway (Req 7.5) ─────────────────────────────────────────────────────
  describe('highway', () => {
    it('morning peak (08:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(8, 'highway')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('evening peak (17:00) is in Heavy range (50–79)', () => {
      const out = getZoneProfile(17, 'highway')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(50)
      expect(out.vehicleCount).toBeLessThanOrEqual(79)
    })

    it('night quiet (00:00) has higher base than residential night', () => {
      const highway = getZoneProfile(0, 'highway')
      const residential = getZoneProfile(0, 'residential')
      expect(highway.vehicleCount).toBeGreaterThan(residential.vehicleCount)
    })

    it('off-peak shoulder (13:00) is in Moderate-to-Heavy range (≥20)', () => {
      const out = getZoneProfile(13, 'highway')
      expect(out.vehicleCount).toBeGreaterThanOrEqual(20)
    })
  })
})
