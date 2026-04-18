import { NextResponse } from 'next/server'
import { simulationEngine } from '@/lib/simulation/engine'

/**
 * POST /api/simulation/optimize
 * Body: { intersectionId: string }
 * Trigger manual optimization for an intersection.
 */
export async function POST(req: Request) {
  try {
    const { intersectionId } = await req.json()
    if (!intersectionId) {
      return NextResponse.json({ error: 'intersectionId is required' }, { status: 400 })
    }

    await simulationEngine.optimizeIntersection(intersectionId)
    return NextResponse.json({ success: true, message: 'Intersection optimized' })
  } catch (err) {
    console.error('[API] Optimization failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
