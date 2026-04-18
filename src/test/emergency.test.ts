/**
 * Integration tests for emergency dispatch logic.
 * Requirements: 15.3, 15.4, 16.1, 16.4, 16.5
 *
 * Uses the real test database. Creates minimal test data (two intersections
 * connected via a shared road segment) in beforeAll.
 *
 * Note: audit_logs are append-only (enforced by DB trigger) and cannot be
 * deleted. Traffic signals that have audit log entries cannot be deleted either
 * (due to ON DELETE SET NULL triggering an UPDATE on audit_logs). Test data
 * that accumulates audit logs is left in place, consistent with the pattern
 * used in signal-override.test.ts.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { SimulationEngine } from '@/lib/simulation/engine'

describe('Emergency Dispatch', () => {
  let engine: SimulationEngine
  let originId: string
  let destinationId: string
  let isolatedIntersectionId: string // an intersection with no connections

  beforeAll(async () => {
    engine = new SimulationEngine()

    // Create a road segment shared by two intersections (so they're connected)
    const segment = await prisma.roadSegment.create({
      data: {
        name: `Emergency Test Segment ${Date.now()}`,
        lengthMeters: 500,
        speedLimitKmh: 60,
      },
    })

    // Create origin intersection
    const origin = await prisma.intersection.create({
      data: {
        name: `Emergency Test Origin ${Date.now()}`,
        latitude: 18.52,
        longitude: 73.85,
        intersectionSegments: {
          create: { segmentId: segment.id },
        },
      },
    })
    originId = origin.id

    // Create destination intersection sharing the same segment
    const destination = await prisma.intersection.create({
      data: {
        name: `Emergency Test Destination ${Date.now()}`,
        latitude: 18.53,
        longitude: 73.86,
        intersectionSegments: {
          create: { segmentId: segment.id },
        },
      },
    })
    destinationId = destination.id

    // Create an isolated intersection (no segments — no path to/from it)
    const isolated = await prisma.intersection.create({
      data: {
        name: `Emergency Test Isolated ${Date.now()}`,
        latitude: 18.60,
        longitude: 73.90,
      },
    })
    isolatedIntersectionId = isolated.id
  })

  it('valid origin/destination returns vehicle with non-empty route (Req 15.3, 15.4)', async () => {
    const vehicle = await engine.dispatchEmergency(originId, destinationId)

    expect(vehicle).toBeDefined()
    expect(vehicle.route).toBeDefined()
    expect(vehicle.route.length).toBeGreaterThan(0)
    expect(vehicle.id).toBeTruthy()
    expect(vehicle.state).toBe('DISPATCHED')

    // Clean up
    await engine.cancelEmergency(vehicle.id)
  })

  it('origin == destination throws an error (Req 15.3)', async () => {
    await expect(engine.dispatchEmergency(originId, originId)).rejects.toThrow()
  })

  it('no path between intersections throws an error (Req 15.3)', async () => {
    // isolatedIntersectionId has no segments, so no path exists
    await expect(
      engine.dispatchEmergency(originId, isolatedIntersectionId),
    ).rejects.toThrow()
  })

  it('after dispatch, signal at first intersection has overrideActive = true (Req 16.1, 16.3)', async () => {
    // Create a traffic signal at the origin intersection
    await prisma.trafficSignal.create({
      data: {
        intersectionId: originId,
        label: `Emergency Override Test Signal ${Date.now()}`,
        currentPhase: 'Red',
      },
    })

    const vehicle = await engine.dispatchEmergency(originId, destinationId)

    try {
      // The first intersection in the route should have its signal overrideActive = true
      const firstIntersectionId = vehicle.route[0]
      const updatedSignal = await prisma.trafficSignal.findFirst({
        where: { intersectionId: firstIntersectionId },
        select: { id: true, overrideActive: true, currentPhase: true },
      })

      expect(updatedSignal).not.toBeNull()
      expect(updatedSignal!.overrideActive).toBe(true)
      expect(updatedSignal!.currentPhase).toBe('Green')
    } finally {
      // Cancel the vehicle (releases overrides); signal itself is left in DB
      // because audit_logs reference it and cannot be deleted
      await engine.cancelEmergency(vehicle.id)
    }
  })

  it('audit log entries are written for each preemption (Req 16.4)', async () => {
    // Need an active user for the audit log FK constraint
    const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } })
    if (!user) {
      console.warn('Skipping: no active user found for audit log FK constraint')
      return
    }

    // Ensure a signal exists at origin
    const existingSignal = await prisma.trafficSignal.findFirst({
      where: { intersectionId: originId },
    })
    if (!existingSignal) {
      await prisma.trafficSignal.create({
        data: {
          intersectionId: originId,
          label: `Audit Test Signal ${Date.now()}`,
          currentPhase: 'Red',
        },
      })
    }

    const countBefore = await prisma.auditLog.count({
      where: { action: 'SIGNAL_OVERRIDE_APPLY' },
    })

    const vehicle = await engine.dispatchEmergency(originId, destinationId)

    const countAfter = await prisma.auditLog.count({
      where: { action: 'SIGNAL_OVERRIDE_APPLY' },
    })

    expect(countAfter).toBeGreaterThan(countBefore)

    await engine.cancelEmergency(vehicle.id)
  })

  it('cancelEmergency releases signal overrides (Req 16.5)', async () => {
    // Ensure a signal exists at origin
    const existingSignal = await prisma.trafficSignal.findFirst({
      where: { intersectionId: originId },
    })
    if (!existingSignal) {
      await prisma.trafficSignal.create({
        data: {
          intersectionId: originId,
          label: `Cancel Test Signal ${Date.now()}`,
          currentPhase: 'Red',
        },
      })
    }

    const vehicle = await engine.dispatchEmergency(originId, destinationId)
    const vehicleId = vehicle.id
    const firstIntersectionId = vehicle.route[0]

    // Cancel the emergency — should not throw
    await expect(engine.cancelEmergency(vehicleId)).resolves.not.toThrow()

    // Signal at first intersection should have overrideActive = false
    const updatedSignal = await prisma.trafficSignal.findFirst({
      where: { intersectionId: firstIntersectionId },
      select: { id: true, overrideActive: true, aiOptimized: true },
    })

    expect(updatedSignal).not.toBeNull()
    expect(updatedSignal!.overrideActive).toBe(false)
    expect(updatedSignal!.aiOptimized).toBe(true)
  })
})
