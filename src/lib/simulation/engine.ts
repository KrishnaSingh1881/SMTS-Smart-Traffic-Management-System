/**
 * SimulationEngine — server-side singleton for Meridian City traffic simulation.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 7.6
 */

import { prisma } from '@/lib/db/prisma'
import { emitSSE } from '@/lib/sse/emitter'
import { getZoneProfile, getTickIntervalMs, type ZoneType } from '@/lib/simulation/zoneProfiles'
import type {
  SimulationState,
  SimulationStatus,
  ActiveScenario,
  EmergencyVehicle,
  ScenarioType,
} from '@/lib/simulation/types'

// ─── Congestion level helper ──────────────────────────────────────────────────

type CongestionLevel = 'Free' | 'Moderate' | 'Heavy' | 'Gridlock'

function computeCongestionLevel(vehicleCount: number): CongestionLevel {
  if (vehicleCount >= 80) return 'Gridlock'
  if (vehicleCount >= 50) return 'Heavy'
  if (vehicleCount >= 20) return 'Moderate'
  return 'Free'
}

function formatSimulatedTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── SimulationEngine ─────────────────────────────────────────────────────────

export class SimulationEngine {
  private state: SimulationState = 'STOPPED'
  private speed: number = 1
  private simulatedMinutes: number = 360 // 06:00
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private activeScenarios: Map<string, ActiveScenario> = new Map()
  private cascadeOverrides: Map<string, number> = new Map() // segmentId → vehicleCount override
  private emergencyVehicles: Map<string, EmergencyVehicle> = new Map()
  private weather: 'Clear' | 'Rainy' | 'Foggy' = 'Clear'
  private optimizationLevel: number = 100 // 0-100 city efficiency

  // ── Public control methods ──────────────────────────────────────────────────

  play(speed?: number): void {
    if (speed !== undefined) {
      this.speed = speed
    }
    if (this.state === 'RUNNING') return

    this.state = 'RUNNING'
    this._startTickLoop()
    emitSSE('simulation:state_change', this.getState())

    // Fire an immediate tick so the map shows colours right away
    // without waiting for the first interval to elapse
    this._tick().catch((err) => {
      console.error('[SimulationEngine] immediate tick error:', err)
    })
  }

  pause(): void {
    if (this.state !== 'RUNNING') return

    this.state = 'PAUSED'
    this._stopTickLoop()
    emitSSE('simulation:state_change', this.getState())
  }

  reset(): void {
    this._stopTickLoop()
    this.state = 'STOPPED'
    this.speed = 1
    this.simulatedMinutes = 360 // back to 06:00
    this.activeScenarios.clear()
    this.cascadeOverrides.clear()
    this.emergencyVehicles.clear()
    emitSSE('simulation:state_change', this.getState())
  }

  // ── Scenario preset handlers (T3.2) ───────────────────────────────────────

  async triggerScenario(type: ScenarioType): Promise<void> {
    const scenarioId = crypto.randomUUID()
    const affectedSegmentIds: string[] = []
    const incidentIds: string[] = []

    switch (type) {
      case 'rush_hour':
        await this._triggerRushHour(scenarioId, affectedSegmentIds)
        break
      case 'stadium_exodus':
        await this._triggerStadiumExodus(scenarioId, affectedSegmentIds)
        break
      case 'major_accident':
        await this._triggerMajorAccident(scenarioId, affectedSegmentIds, incidentIds)
        break
      case 'flash_flood':
        await this._triggerFlashFlood(scenarioId, affectedSegmentIds, incidentIds)
        break
    }

    const durationSimMinutes = type === 'rush_hour' ? 15 : type === 'stadium_exodus' ? 20 : 30

    const scenario: ActiveScenario = {
      id: scenarioId,
      type,
      startSimTime: this.simulatedMinutes,
      durationSimMinutes,
      affectedSegmentIds,
      incidentIds,
    }
    this.activeScenarios.set(scenarioId, scenario)

    emitSSE('simulation:scenario_update', {
      scenarioId,
      type,
      affectedSegmentIds,
      startSimTime: this.simulatedMinutes,
      durationSimMinutes,
    })
  }

  private async _triggerRushHour(
    _scenarioId: string,
    affectedSegmentIds: string[],
  ): Promise<void> {
    // Req 9.2: set all commercial and transit segments to Heavy (65) or Gridlock (85)
    const segments = await prisma.roadSegment.findMany({
      where: {
        OR: [
          { zoneType: { has: 'commercial' } },
          { zoneType: { has: 'transit' } },
        ],
      },
      select: { id: true },
    })

    for (const seg of segments) {
      // Alternate between Heavy (65) and Gridlock (85) for visual variety
      const count = affectedSegmentIds.length % 2 === 0 ? 85 : 65
      this.cascadeOverrides.set(seg.id, count)
      affectedSegmentIds.push(seg.id)
    }
  }

  private async _triggerStadiumExodus(
    _scenarioId: string,
    affectedSegmentIds: string[],
  ): Promise<void> {
    // Req 9.3: 5 nearest segments to Stadium Road → Gridlock; 3 adjacent → Heavy
    const allSegments = await prisma.roadSegment.findMany({
      select: {
        id: true,
        name: true,
        routeEdgesFrom: { select: { toSegmentId: true } },
        routeEdgesTo: { select: { fromSegmentId: true } },
      },
    })

    // Find Stadium Road segment first
    const stadiumSegment = allSegments.find((s) =>
      s.name.toLowerCase().includes('stadium'),
    )

    // Build adjacency map
    const adjacencyMap = new Map<string, Set<string>>()
    for (const seg of allSegments) {
      if (!adjacencyMap.has(seg.id)) adjacencyMap.set(seg.id, new Set())
      for (const edge of seg.routeEdgesFrom) {
        adjacencyMap.get(seg.id)!.add(edge.toSegmentId)
        if (!adjacencyMap.has(edge.toSegmentId)) adjacencyMap.set(edge.toSegmentId, new Set())
        adjacencyMap.get(edge.toSegmentId)!.add(seg.id)
      }
      for (const edge of seg.routeEdgesTo) {
        adjacencyMap.get(seg.id)!.add(edge.fromSegmentId)
        if (!adjacencyMap.has(edge.fromSegmentId)) adjacencyMap.set(edge.fromSegmentId, new Set())
        adjacencyMap.get(edge.fromSegmentId)!.add(seg.id)
      }
    }

    // BFS from stadium segment to find 5 nearest segments
    const gridlockIds: string[] = []
    if (stadiumSegment) {
      const visited = new Set<string>([stadiumSegment.id])
      const queue: string[] = [stadiumSegment.id]
      gridlockIds.push(stadiumSegment.id)

      while (gridlockIds.length < 5 && queue.length > 0) {
        const current = queue.shift()!
        const neighbors = adjacencyMap.get(current) ?? new Set()
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && gridlockIds.length < 5) {
            visited.add(neighbor)
            gridlockIds.push(neighbor)
            queue.push(neighbor)
          }
        }
      }
    } else {
      // Fallback: pick first 5 segments
      for (const seg of allSegments.slice(0, 5)) {
        gridlockIds.push(seg.id)
      }
    }

    // Set 5 nearest to Gridlock (85)
    for (const segId of gridlockIds) {
      this.cascadeOverrides.set(segId, 85)
      affectedSegmentIds.push(segId)
    }

    // Set 3 adjacent segments to Heavy (65)
    const adjacentHeavy = new Set<string>()
    for (const segId of gridlockIds) {
      const neighbors = adjacencyMap.get(segId) ?? new Set()
      for (const neighbor of neighbors) {
        if (!gridlockIds.includes(neighbor) && adjacentHeavy.size < 3) {
          adjacentHeavy.add(neighbor)
        }
      }
      if (adjacentHeavy.size >= 3) break
    }

    for (const segId of adjacentHeavy) {
      this.cascadeOverrides.set(segId, 65)
      affectedSegmentIds.push(segId)
    }
  }

  private async _triggerMajorAccident(
    _scenarioId: string,
    affectedSegmentIds: string[],
    incidentIds: string[],
  ): Promise<void> {
    // Req 9.4: pick one highway segment at random; create Accident incident
    const highwaySegments = await prisma.roadSegment.findMany({
      where: { zoneType: { has: 'highway' } },
      select: {
        id: true,
        routeEdgesFrom: { select: { toSegmentId: true } },
        routeEdgesTo: { select: { fromSegmentId: true } },
      },
    })

    if (highwaySegments.length === 0) return

    const randomIndex = Math.floor(Math.random() * highwaySegments.length)
    const chosenSegment = highwaySegments[randomIndex]

    // Create Accident incident via Prisma directly (server-side)
    const incident = await this._createIncidentWithRetry({
      segmentId: chosenSegment.id,
      type: 'Accident',
      severity: 4,
      description: 'Scenario-triggered major accident',
      status: 'Active',
    })

    if (incident) {
      incidentIds.push(incident.id)
    }

    // Set chosen segment to Gridlock (85)
    this.cascadeOverrides.set(chosenSegment.id, 85)
    affectedSegmentIds.push(chosenSegment.id)

    // Collect adjacent segments
    const adjacentIds = new Set<string>()
    for (const edge of chosenSegment.routeEdgesFrom) {
      adjacentIds.add(edge.toSegmentId)
    }
    for (const edge of chosenSegment.routeEdgesTo) {
      adjacentIds.add(edge.fromSegmentId)
    }

    // Set 2 adjacent segments to Heavy (65)
    let heavyCount = 0
    for (const adjId of adjacentIds) {
      if (heavyCount >= 2) break
      this.cascadeOverrides.set(adjId, 65)
      affectedSegmentIds.push(adjId)
      heavyCount++
    }

    // Emit AI anomaly alert (Req 9.4)
    emitSSE('ai:token', {
      token: `⚠️ ANOMALY ALERT: Major accident detected on highway segment. Gridlock conditions spreading. Emergency response recommended.`,
      insightId: crypto.randomUUID(),
    })
  }

  private async _triggerFlashFlood(
    _scenarioId: string,
    affectedSegmentIds: string[],
    incidentIds: string[],
  ): Promise<void> {
    // Req 9.5: create Flooding incidents on all 3 flood_risk segments; set to Gridlock
    const floodSegments = await prisma.roadSegment.findMany({
      where: { floodRisk: true },
      select: { id: true },
    })

    for (const seg of floodSegments) {
      const incident = await this._createIncidentWithRetry({
        segmentId: seg.id,
        type: 'Flooding',
        severity: 4,
        description: 'Scenario-triggered flash flood',
        status: 'Active',
      })

      if (incident) {
        incidentIds.push(incident.id)
      }

      // Set to Gridlock (85)
      this.cascadeOverrides.set(seg.id, 85)
      affectedSegmentIds.push(seg.id)
    }

    // Re-route active routes away from flooded segments (Req 9.5)
    // Mark flooded segments so routing avoids them — done via cascadeOverrides at max count
    // The routing layer will see these as Gridlock and avoid them
  }

  /**
   * Persist an incident via Prisma directly (server-side).
   * Retries once after 2s on failure (Req 9.6).
   */
  private async _createIncidentWithRetry(data: {
    segmentId: string
    type: 'Accident' | 'Flooding'
    severity: number
    description: string
    status: 'Active'
  }): Promise<{ id: string } | null> {
    const create = () =>
      prisma.incident.create({
        data: {
          segmentId: data.segmentId,
          type: data.type as import('@prisma/client').IncidentType,
          severity: data.severity,
          description: data.description,
          status: data.status as import('@prisma/client').IncidentStatus,
        },
        select: { id: true },
      })

    try {
      return await create()
    } catch (err) {
      console.error('[SimulationEngine] incident create failed, retrying in 2s:', err)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      try {
        return await create()
      } catch (retryErr) {
        console.error('[SimulationEngine] incident create retry failed:', retryErr)
        return null
      }
    }
  }

  /**
   * Dispatch an emergency vehicle from originId to destinationId (intersection IDs).
   * Uses Dijkstra routing over the intersection graph (ignoring congestion weights).
   * Requirements: 15.3, 15.4, 15.5, 16.1, 16.2, 16.3, 16.4
   */
  async dispatchEmergency(originId: string, destinationId: string): Promise<EmergencyVehicle> {
    // Build intersection graph and run Dijkstra ignoring congestion
    if (originId === destinationId) {
      throw new Error(`Origin and destination intersections must be different`)
    }
    const route = await this._findIntersectionRoute(originId, destinationId)
    if (!route || route.length === 0) {
      throw new Error(`No route found between intersections ${originId} and ${destinationId}`)
    }

    const vehicleId = crypto.randomUUID()
    const vehicle: EmergencyVehicle = {
      id: vehicleId,
      route,
      currentIndex: 0,
      speedKmh: 80,
      state: 'DISPATCHED',
      preemptedSignalIds: [],
    }
    this.emergencyVehicles.set(vehicleId, vehicle)

    // Apply signal preemption at first intersection
    const firstIntersectionId = route[0]
    await this._preemptSignalAtIntersection(vehicle, firstIntersectionId)

    // Emit SSE event
    emitSSE('simulation:emergency_update', {
      vehicleId,
      state: vehicle.state,
      route,
      currentIndex: vehicle.currentIndex,
      preemptedSignalIds: vehicle.preemptedSignalIds,
    })

    // Req 22.1: Emit dispatch narration with intersection names and estimated clearance time
    const intersectionNames = await this._getIntersectionNames(route)
    const estimatedMinutes = route.length // 1 minute per intersection as estimate
    const narrationInsightId = crypto.randomUUID()
    emitSSE('ai:token', {
      token: `Emergency vehicle on route. Clearing signals: ${intersectionNames.join(', ')}. Estimated clearance time: ${estimatedMinutes} min.`,
      insightId: narrationInsightId,
    })
    emitSSE('ai:insight_complete', {
      insightId: narrationInsightId,
      text: `Emergency vehicle on route. Clearing signals: ${intersectionNames.join(', ')}. Estimated clearance time: ${estimatedMinutes} min.`,
    })

    return vehicle
  }

  /**
   * Fetch intersection names for a list of intersection IDs.
   * Returns names in the same order as the input IDs; falls back to the ID if name is missing.
   * Requirements: 22.1
   */
  private async _getIntersectionNames(intersectionIds: string[]): Promise<string[]> {
    if (intersectionIds.length === 0) return []
    const intersections = await prisma.intersection.findMany({
      where: { id: { in: intersectionIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(intersections.map((i) => [i.id, i.name]))
    return intersectionIds.map((id) => nameMap.get(id) ?? id)
  }

  /**
   * Cancel an active emergency vehicle dispatch.
   * Releases all preempted signals and removes the vehicle.
   * Requirements: 16.5
   */
  async cancelEmergency(vehicleId: string): Promise<void> {
    const vehicle = this.emergencyVehicles.get(vehicleId)
    if (!vehicle) return

    // Release all preempted signals
    for (const signalId of vehicle.preemptedSignalIds) {
      await this._releaseSignalPreemption(signalId)
    }

    this.emergencyVehicles.delete(vehicleId)

    emitSSE('simulation:emergency_update', {
      vehicleId,
      state: 'CANCELLED',
      route: vehicle.route,
      currentIndex: vehicle.currentIndex,
      preemptedSignalIds: [],
    })
  }

  /**
   * Find a route between two intersections using Dijkstra (ignoring congestion weights).
   * Returns an array of intersection IDs, or null if no path exists.
   */
  private async _findIntersectionRoute(
    originId: string,
    destinationId: string,
  ): Promise<string[] | null> {
    // Fetch all intersections and their connected segments to build adjacency
    const intersections = await prisma.intersection.findMany({
      select: {
        id: true,
        intersectionSegments: {
          select: { segmentId: true },
        },
      },
    })

    // Build segment → intersections map
    const segmentToIntersections = new Map<string, string[]>()
    for (const intersection of intersections) {
      for (const { segmentId } of intersection.intersectionSegments) {
        const list = segmentToIntersections.get(segmentId) ?? []
        list.push(intersection.id)
        segmentToIntersections.set(segmentId, list)
      }
    }

    // Build intersection adjacency graph (unweighted — ignoring congestion)
    const graph = new Map<string, Set<string>>()
    for (const intersection of intersections) {
      if (!graph.has(intersection.id)) graph.set(intersection.id, new Set())
      for (const { segmentId } of intersection.intersectionSegments) {
        const connectedIntersections = segmentToIntersections.get(segmentId) ?? []
        for (const otherId of connectedIntersections) {
          if (otherId !== intersection.id) {
            graph.get(intersection.id)!.add(otherId)
          }
        }
      }
    }

    // Dijkstra (unweighted = BFS equivalent, but using Dijkstra for consistency)
    const distances = new Map<string, number>()
    const previous = new Map<string, string | null>()
    const unvisited = new Set<string>()

    for (const intersection of intersections) {
      distances.set(intersection.id, intersection.id === originId ? 0 : Infinity)
      previous.set(intersection.id, null)
      unvisited.add(intersection.id)
    }

    while (unvisited.size > 0) {
      // Find node with minimum distance
      let current: string | null = null
      let minDist = Infinity
      for (const nodeId of unvisited) {
        const d = distances.get(nodeId) ?? Infinity
        if (d < minDist) {
          minDist = d
          current = nodeId
        }
      }

      if (current === null || minDist === Infinity) break
      if (current === destinationId) break

      unvisited.delete(current)

      const neighbors = graph.get(current) ?? new Set()
      for (const neighborId of neighbors) {
        const alt = minDist + 1
        if (alt < (distances.get(neighborId) ?? Infinity)) {
          distances.set(neighborId, alt)
          previous.set(neighborId, current)
        }
      }
    }

    // Reconstruct path
    if ((distances.get(destinationId) ?? Infinity) === Infinity) return null

    const path: string[] = []
    let cur: string | null = destinationId
    while (cur !== null) {
      path.unshift(cur)
      cur = previous.get(cur) ?? null
    }

    return path.length > 0 && path[0] === originId ? path : null
  }

  /**
   * Apply signal preemption at a given intersection for an emergency vehicle.
   * Sets the signal to Green for 60s and writes an AuditLog entry.
   * Requirements: 16.1, 16.2, 16.3, 16.4
   */
  private async _preemptSignalAtIntersection(
    vehicle: EmergencyVehicle,
    intersectionId: string,
  ): Promise<void> {
    // Find the traffic signal at this intersection
    const signal = await prisma.trafficSignal.findFirst({
      where: { intersectionId },
      select: { id: true },
    })

    if (!signal) return

    const overrideExpiresAt = new Date(Date.now() + 60_000)

    // Deactivate existing phases and create a new Green emergency phase
    await prisma.$transaction([
      // Deactivate all current phases
      prisma.signalPhase.updateMany({
        where: { signalId: signal.id, isActive: true },
        data: { isActive: false },
      }),
      // Create new Green emergency phase
      prisma.signalPhase.create({
        data: {
          signalId: signal.id,
          phaseState: 'Green',
          durationSeconds: 60,
          sequenceOrder: 0,
          isActive: true,
          source: 'manual_override',
        },
      }),
      // Update signal state
      prisma.trafficSignal.update({
        where: { id: signal.id },
        data: {
          currentPhase: 'Green',
          overrideActive: true,
          overrideExpiresAt,
          lastUpdatedAt: new Date(),
        },
      }),
    ])

    // Write AuditLog — find any user to satisfy the FK constraint
    await this._writeEmergencyAuditLog(signal.id, intersectionId)

    // Track preempted signal
    if (!vehicle.preemptedSignalIds.includes(signal.id)) {
      vehicle.preemptedSignalIds.push(signal.id)
    }

    // Emit signal preemption SSE event
    emitSSE('simulation:signal_preemption', {
      signalId: signal.id,
      intersectionId,
      vehicleId: vehicle.id,
      phase: 'Green',
      durationSeconds: 60,
    })
  }

  /**
   * Release signal preemption and revert to AI-optimised timing.
   * Requirements: 16.5
   */
  private async _releaseSignalPreemption(signalId: string): Promise<void> {
    try {
      await prisma.$transaction([
        // Deactivate emergency phase
        prisma.signalPhase.updateMany({
          where: { signalId, source: 'manual_override', isActive: true },
          data: { isActive: false },
        }),
        // Revert signal to AI-optimised state
        prisma.trafficSignal.update({
          where: { id: signalId },
          data: {
            overrideActive: false,
            overrideExpiresAt: null,
            aiOptimized: true,
            lastUpdatedAt: new Date(),
          },
        }),
      ])
    } catch (err) {
      console.error('[SimulationEngine] failed to release signal preemption:', err)
    }
  }

  /**
   * Write an AuditLog entry for emergency signal override.
   * Uses the first available user as the actor (system action).
   * Requirements: 16.4
   */
  private async _writeEmergencyAuditLog(
    signalId: string,
    intersectionId: string,
  ): Promise<void> {
    try {
      // Find any active user to satisfy the FK constraint
      const systemUser = await prisma.user.findFirst({
        where: { isActive: true },
        select: { id: true },
      })

      if (!systemUser) {
        console.warn('[SimulationEngine] no user found for emergency audit log — skipping')
        return
      }

      await prisma.auditLog.create({
        data: {
          action: 'SIGNAL_OVERRIDE_APPLY',
          userId: systemUser.id,
          signalId,
          metadata: {
            intersectionId,
            userId: 'SYSTEM_EMERGENCY',
          },
        },
      })
    } catch (err) {
      console.error('[SimulationEngine] failed to write emergency audit log:', err)
    }
  }

  getState(): SimulationStatus {
    return {
      state: this.state,
      simulatedTime: formatSimulatedTime(this.simulatedMinutes),
      speed: this.speed,
      activeScenarios: Array.from(this.activeScenarios.keys()),
      emergencyVehicleCount: this.emergencyVehicles.size,
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _startTickLoop(): void {
    this._stopTickLoop()
    const intervalMs = getTickIntervalMs(this.speed)
    this.tickTimer = setInterval(() => {
      this._tick().catch((err) => {
        console.error('[SimulationEngine] tick error (skipping):', err)
        // state remains RUNNING per Req 6.8 error handling
      })
    }, intervalMs)
  }

  private _stopTickLoop(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private async _tick(): Promise<void> {
    // Advance simulated clock by 1 minute per tick (at 1x speed)
    this.simulatedMinutes += 1

    // Check for expired scenarios and remove their cascade overrides
    this._expireScenarios()

    // Run sub-steps
    await this.applyCascade()
    await this._generateRandomEvents()
    await this._updateWeather()
    await this.generateObservations()
    await this.advanceEmergencyVehicles()
    await this._calculateGlobalOptimization()

    // Broadcast tick event
    emitSSE('simulation:tick', this.getState())
  }

  /**
   * Removes expired scenarios from activeScenarios and clears their cascadeOverrides.
   * A scenario expires when simulatedMinutes >= startSimTime + durationSimMinutes.
   * Requirements: 9.2, 9.3, 9.4, 9.5
   */
  private _expireScenarios(): void {
    for (const [scenarioId, scenario] of this.activeScenarios) {
      if (this.simulatedMinutes >= scenario.startSimTime + scenario.durationSimMinutes) {
        // Remove cascade overrides for all affected segments
        for (const segId of scenario.affectedSegmentIds) {
          this.cascadeOverrides.delete(segId)
        }
        this.activeScenarios.delete(scenarioId)
      }
    }
  }

  private async generateObservations(): Promise<void> {
    // Fetch all road segments with their zone types
    const segments = await prisma.roadSegment.findMany({
      select: {
        id: true,
        zoneType: true,
        speedLimitKmh: true,
      },
    })

    const simulatedHour = Math.floor(this.simulatedMinutes / 60) % 24
    const now = new Date()

    const observationsData: any[] = []
    const segmentUpdates: any[] = []
    const sseEvents: any[] = []

    for (const segment of segments) {
      // Determine zone type — use first entry, default to 'residential'
      const zoneType: ZoneType =
        (segment.zoneType[0] as ZoneType | undefined) ?? 'residential'

      // Get base values from zone profile
      const base = getZoneProfile(simulatedHour, zoneType)

      // Apply ±15% variance
      const vehicleCount = Math.round(base.vehicleCount * (0.85 + Math.random() * 0.30))
      const avgSpeedKmh = Math.round(base.avgSpeedKmh * (0.85 + Math.random() * 0.30) * 100) / 100

      // Check for cascade override
      const cascadeCount = this.cascadeOverrides.get(segment.id)
      const finalVehicleCount = cascadeCount !== undefined ? cascadeCount : vehicleCount

      const congestionLevel = computeCongestionLevel(finalVehicleCount)

      // Collect data for bulk creation
      observationsData.push({
        segmentId: segment.id,
        vehicleCount: finalVehicleCount,
        avgSpeedKmh,
        congestionLevel,
        observedAt: now,
      })

      // Collect updates for transaction
      segmentUpdates.push(
        prisma.roadSegment.update({
          where: { id: segment.id },
          data: {
            currentCongestion: congestionLevel,
            lastObservationAt: now,
          },
        })
      )

      // Collect events for broadcasting
      sseEvents.push({
        segmentId: segment.id,
        vehicleCount: finalVehicleCount,
        avgSpeedKmh,
        congestionLevel,
        lastObservationAt: now.toISOString(),
      })
    }

    // Execute DB operations in batch/parallel
    // createMany is much faster for bulk inserts
    // $transaction groups update queries
    await Promise.all([
      prisma.trafficObservation.createMany({ data: observationsData }),
      prisma.$transaction(segmentUpdates),
    ])

    // Broadcast all tick results
    for (const event of sseEvents) {
      emitSSE('segment:update', event)
    }
  }

  /**
   * Removes a segment from cascadeOverrides (called when an incident on a Gridlock
   * segment is resolved). On the next tick, the segment reverts to zone-based generation.
   * Requirements: 11.3
   */
  clearCascadeForSegment(segmentId: string): void {
    this.cascadeOverrides.delete(segmentId)
  }

  /**
   * Computes cascade/ripple overrides for adjacent segments of Gridlock segments.
   * - Hop 1: all segments adjacent to a Gridlock segment get +20% vehicle count (capped at 80)
   * - Hop 2: if a hop-1 segment also reaches Gridlock after the increase, its adjacent
   *   segments also get +20% (capped at 80). No further propagation.
   * - Runs entirely in-memory; no DB writes.
   * Requirements: 11.1, 11.2, 11.3, 11.4
   */
  private async applyCascade(): Promise<void> {
    // Fetch current vehicle counts and adjacency in one query
    const segments = await prisma.roadSegment.findMany({
      select: {
        id: true,
        currentCongestion: true,
        routeEdgesFrom: { select: { toSegmentId: true } },
        routeEdgesTo: { select: { fromSegmentId: true } },
      },
    })

    // Build a map of segmentId → current vehicle count (from latest observation or cascade override)
    const observations = await prisma.trafficObservation.findMany({
      where: { segmentId: { in: segments.map((s) => s.id) } },
      orderBy: { observedAt: 'desc' },
      distinct: ['segmentId'],
      select: { segmentId: true, vehicleCount: true },
    })

    const vehicleCountMap = new Map<string, number>()
    for (const obs of observations) {
      vehicleCountMap.set(obs.segmentId, obs.vehicleCount)
    }

    // Build adjacency map: segmentId → Set of adjacent segment IDs (bidirectional)
    const adjacencyMap = new Map<string, Set<string>>()
    for (const seg of segments) {
      if (!adjacencyMap.has(seg.id)) adjacencyMap.set(seg.id, new Set())
      for (const edge of seg.routeEdgesFrom) {
        adjacencyMap.get(seg.id)!.add(edge.toSegmentId)
        if (!adjacencyMap.has(edge.toSegmentId)) adjacencyMap.set(edge.toSegmentId, new Set())
        adjacencyMap.get(edge.toSegmentId)!.add(seg.id)
      }
      for (const edge of seg.routeEdgesTo) {
        adjacencyMap.get(seg.id)!.add(edge.fromSegmentId)
        if (!adjacencyMap.has(edge.fromSegmentId)) adjacencyMap.set(edge.fromSegmentId, new Set())
        adjacencyMap.get(edge.fromSegmentId)!.add(seg.id)
      }
    }

    // Identify Gridlock segments (vehicleCount >= 80 OR currentCongestion === 'Gridlock')
    const gridlockIds = new Set<string>()
    for (const seg of segments) {
      const count = this.cascadeOverrides.get(seg.id) ?? vehicleCountMap.get(seg.id) ?? 0
      if (count >= 80 || seg.currentCongestion === 'Gridlock') {
        gridlockIds.add(seg.id)
      }
    }

    if (gridlockIds.size === 0) return

    // New cascade overrides to apply this tick
    const newOverrides = new Map<string, number>()

    const applyIncrease = (segmentId: string): number => {
      const current = this.cascadeOverrides.get(segmentId) ?? vehicleCountMap.get(segmentId) ?? 0
      const increased = Math.round(current * 1.2)
      return Math.min(increased, 80)
    }

    // Hop 1: adjacent segments of Gridlock segments
    const hop1Gridlock = new Set<string>()
    for (const gridlockId of gridlockIds) {
      const neighbors = adjacencyMap.get(gridlockId) ?? new Set()
      for (const neighborId of neighbors) {
        if (gridlockIds.has(neighborId)) continue // already Gridlock, skip
        const newCount = applyIncrease(neighborId)
        // Only override if the cascade increases the count
        const existing = newOverrides.get(neighborId) ?? 0
        newOverrides.set(neighborId, Math.max(existing, newCount))
        if (newCount >= 80) {
          hop1Gridlock.add(neighborId)
        }
      }
    }

    // Hop 2: adjacent segments of hop-1 segments that reached Gridlock
    for (const hop1Id of hop1Gridlock) {
      const neighbors = adjacencyMap.get(hop1Id) ?? new Set()
      for (const neighborId of neighbors) {
        if (gridlockIds.has(neighborId)) continue // already Gridlock
        if (hop1Gridlock.has(neighborId)) continue // already processed at hop 1
        const newCount = applyIncrease(neighborId)
        const existing = newOverrides.get(neighborId) ?? 0
        newOverrides.set(neighborId, Math.max(existing, newCount))
      }
    }

    // Merge new overrides into cascadeOverrides
    for (const [segId, count] of newOverrides) {
      this.cascadeOverrides.set(segId, count)
    }

    // Remove overrides for segments that are no longer adjacent to any Gridlock segment
    // (i.e., the Gridlock that caused them has been resolved)
    const allCascadeTargets = new Set<string>()
    for (const gridlockId of gridlockIds) {
      const neighbors = adjacencyMap.get(gridlockId) ?? new Set()
      for (const n of neighbors) allCascadeTargets.add(n)
    }
    for (const hop1Id of hop1Gridlock) {
      const neighbors = adjacencyMap.get(hop1Id) ?? new Set()
      for (const n of neighbors) allCascadeTargets.add(n)
    }
    for (const segId of this.cascadeOverrides.keys()) {
      if (!allCascadeTargets.has(segId)) {
        this.cascadeOverrides.delete(segId)
      }
    }
  }

  /**
   * Look up the traffic signal ID for a given intersection.
   * Returns null if no signal exists at that intersection.
   */
  private async _getSignalIdForIntersection(intersectionId: string): Promise<string | null> {
    const signal = await prisma.trafficSignal.findFirst({
      where: { intersectionId },
      select: { id: true },
    })
    return signal?.id ?? null
  }

  /**
   * Advance each active emergency vehicle by one intersection per tick.
   * - Preempts signal at the next intersection (Green, 60s, audit log)
   * - Releases signal at the previous intersection (reverts to AI-optimised)
   * - Emits simulation:signal_preemption and simulation:emergency_update SSE events
   * Requirements: 16.1, 16.2, 16.4, 16.5
   */
  private async advanceEmergencyVehicles(): Promise<void> {
    for (const vehicle of this.emergencyVehicles.values()) {
      if (vehicle.state !== 'DISPATCHED' && vehicle.state !== 'IN_TRANSIT') continue

      // Advance position
      vehicle.currentIndex += 1
      vehicle.state = 'IN_TRANSIT'

      const nextIntersectionId = vehicle.route[vehicle.currentIndex]
      const prevIntersectionId = vehicle.route[vehicle.currentIndex - 1]

      // Preempt signal at next intersection
      if (nextIntersectionId) {
        await this._preemptSignalAtIntersection(vehicle, nextIntersectionId)
      }

      // Release signal at previous intersection
      if (prevIntersectionId) {
        const prevSignalId = await this._getSignalIdForIntersection(prevIntersectionId)
        if (prevSignalId) {
          await this._releaseSignalPreemption(prevSignalId)
          // Remove from tracked preempted list
          vehicle.preemptedSignalIds = vehicle.preemptedSignalIds.filter(
            (id) => id !== prevSignalId,
          )
        }
      }

      // Emit current position update
      emitSSE('simulation:emergency_update', {
        vehicleId: vehicle.id,
        state: vehicle.state,
        route: vehicle.route,
        currentIndex: vehicle.currentIndex,
        preemptedSignalIds: vehicle.preemptedSignalIds,
      })

      // Check if vehicle has reached its destination
      if (vehicle.currentIndex >= vehicle.route.length - 1) {
        vehicle.state = 'COMPLETED'

        // Release all remaining preempted signals (revert to AI-optimised timing)
        for (const signalId of [...vehicle.preemptedSignalIds]) {
          await this._releaseSignalPreemption(signalId)
        }
        vehicle.preemptedSignalIds = []

        // Req 18.3: Create Incident record for completed dispatch
        await this._createEmergencyCompletionIncident(vehicle)

        // Req 18.1, 18.4: Emit completion SSE event
        emitSSE('simulation:emergency_update', {
          vehicleId: vehicle.id,
          state: 'COMPLETED',
          route: vehicle.route,
          currentIndex: vehicle.currentIndex,
          preemptedSignalIds: [],
          completed: true,
        })

        // Req 18.4: Trigger AI narration for completion
        const completionInsightId = crypto.randomUUID()
        emitSSE('ai:token', {
          token: `Emergency vehicle dispatch completed. Route cleared. All signals restored to normal operation.`,
          insightId: completionInsightId,
        })
        emitSSE('ai:insight_complete', {
          insightId: completionInsightId,
          text: `Emergency vehicle dispatch completed. Route cleared. All signals restored to normal operation.`,
        })

        // Remove completed vehicle from the map after a short delay
        setTimeout(() => {
          this.emergencyVehicles.delete(vehicle.id)
        }, 5000)
      }
    }
  }

  /**
   * Creates an Incident record when an emergency vehicle completes its route.
   * Uses the last segment in the route (via the destination intersection) as the segmentId.
   * Requirements: 18.3
   */
  private async _createEmergencyCompletionIncident(vehicle: EmergencyVehicle): Promise<void> {
    try {
      // Find a segment associated with the destination intersection
      const destinationIntersectionId = vehicle.route[vehicle.route.length - 1]
      const intersectionSegment = await prisma.intersectionSegment.findFirst({
        where: { intersectionId: destinationIntersectionId },
        select: { segmentId: true },
      })

      if (!intersectionSegment) {
        console.warn(
          '[SimulationEngine] no segment found for destination intersection — skipping completion incident',
        )
        return
      }

      await prisma.incident.create({
        data: {
          segmentId: intersectionSegment.segmentId,
          type: 'Other',
          description: 'Emergency vehicle dispatch completed',
          severity: 1,
          status: 'Resolved',
        },
      })
    } catch (err) {
      console.error('[SimulationEngine] failed to create emergency completion incident:', err)
    }
  }

  // ── Gamification Helpers ────────────────────────────────────────────────────

  private async _generateRandomEvents(): Promise<void> {
    // 0.5% chance per tick for a random accident
    if (Math.random() < 0.005) {
      console.log('[SimulationEngine] Triggering random major_accident event')
      await this.triggerScenario('major_accident')
    }
  }

  private async _updateWeather(): Promise<void> {
    // 2% chance per tick to change weather
    if (Math.random() < 0.02) {
      const weathers: ('Clear' | 'Rainy' | 'Foggy')[] = ['Clear', 'Rainy', 'Foggy']
      const newWeather = weathers[Math.floor(Math.random() * weathers.length)]
      if (newWeather !== this.weather) {
        this.weather = newWeather
        emitSSE('simulation:weather_change', { weather: this.weather })
      }
    }
  }

  private async _calculateGlobalOptimization(): Promise<void> {
    // Optimization score is 100 minus the average percentage of Gridlock/Heavy segments
    const segments = await prisma.roadSegment.findMany({
      select: { currentCongestion: true }
    })
    if (segments.length === 0) return

    const congestionPoints = {
      'Free': 0,
      'Moderate': 10,
      'Heavy': 40,
      'Gridlock': 100
    }

    const totalPoints = segments.reduce((sum, s) => sum + (congestionPoints[s.currentCongestion as keyof typeof congestionPoints] || 0), 0)
    const maxPoints = segments.length * 100
    const score = Math.max(0, Math.round(100 - (totalPoints / maxPoints) * 100))

    if (score !== this.optimizationLevel) {
      this.optimizationLevel = score
      emitSSE('simulation:score_update', { score })
    }
  }

  /**
   * Manually optimize an intersection.
   * Resets signals and slightly reduces vehicle counts on all connected segments.
   */
  async optimizeIntersection(intersectionId: string): Promise<void> {
    // Find segments connected to this intersection
    const intersectionSegments = await prisma.intersectionSegment.findMany({
      where: { intersectionId },
      select: { segmentId: true }
    })

    for (const is of intersectionSegments) {
      // Manually "clear" 30% of traffic
      const current = this.cascadeOverrides.get(is.segmentId)
      if (current) {
        this.cascadeOverrides.set(is.segmentId, Math.max(0, Math.round(current * 0.7)))
      }
    }

    // Give some XP or feedback
    emitSSE('simulation:xp_gain', { amount: 50, reason: 'Manual Optimization' })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __simulationEngine: SimulationEngine | undefined
}

export const simulationEngine: SimulationEngine =
  globalThis.__simulationEngine ?? new SimulationEngine()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__simulationEngine = simulationEngine
}
