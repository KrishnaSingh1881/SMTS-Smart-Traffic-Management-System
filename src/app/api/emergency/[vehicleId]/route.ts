/**
 * DELETE /api/emergency/[vehicleId]
 * Cancel an active emergency vehicle dispatch and release all signal overrides.
 * Requirements: 15.5
 */

import { NextResponse } from 'next/server'
import { simulationEngine } from '@/lib/simulation/engine'

export async function DELETE(
  _request: Request,
  { params }: { params: { vehicleId: string } },
) {
  const { vehicleId } = params

  await simulationEngine.cancelEmergency(vehicleId)

  return NextResponse.json({ success: true })
}
