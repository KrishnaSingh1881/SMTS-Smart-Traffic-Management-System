/**
 * POST /api/emergency/dispatch
 * Dispatch an emergency vehicle between two intersections.
 * Requirements: 15.3
 */

import { NextResponse } from 'next/server'
import { simulationEngine } from '@/lib/simulation/engine'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { originId, destinationId } = body as { originId?: unknown; destinationId?: unknown }

  if (!originId || typeof originId !== 'string') {
    return NextResponse.json({ error: 'originId is required' }, { status: 400 })
  }

  if (!destinationId || typeof destinationId !== 'string') {
    return NextResponse.json({ error: 'destinationId is required' }, { status: 400 })
  }

  try {
    const vehicle = await simulationEngine.dispatchEmergency(originId, destinationId)
    return NextResponse.json({ vehicleId: vehicle.id, route: vehicle.route })
  } catch {
    return NextResponse.json({ error: 'No route found' }, { status: 422 })
  }
}
