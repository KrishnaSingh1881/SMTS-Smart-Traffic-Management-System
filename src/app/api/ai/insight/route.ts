/**
 * POST /api/ai/insight
 * Triggers async AI insight generation and streams tokens via SSE.
 * Returns { insightId } immediately; generation happens in the background.
 * Requirements: 13.2, 13.3, 13.5, 13.6, 13.7
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ollamaGenerate } from '@/lib/ai/ollama'
import { emitSSE } from '@/lib/sse/emitter'
import { buildInsightPrompt } from '@/lib/ai/insightPrompt'
import { simulationEngine } from '@/lib/simulation/engine'
import type { TriggerType } from '@/lib/simulation/types'

// Congestion level ordering for sorting (highest first)
const CONGESTION_ORDER: Record<string, number> = {
  Gridlock: 3,
  Heavy: 2,
  Moderate: 1,
  Free: 0,
}

export async function POST(request: NextRequest) {
  let trigger: TriggerType = 'manual'

  try {
    const body = await request.json()
    if (body?.trigger) {
      trigger = body.trigger as TriggerType
    }
  } catch {
    // default to 'manual' if body is missing or invalid
  }

  const insightId = crypto.randomUUID()

  // Return insightId immediately — generation is async
  void runInsightGeneration(insightId, trigger)

  return NextResponse.json({ insightId })
}

async function runInsightGeneration(insightId: string, trigger: TriggerType) {
  try {
    // Fetch top 3 congested segments (Gridlock > Heavy > Moderate > Free)
    const segments = await prisma.roadSegment.findMany({
      select: { id: true, name: true, currentCongestion: true },
    })

    const topSegments = segments
      .filter((s) => s.currentCongestion !== 'Free')
      .sort(
        (a, b) =>
          (CONGESTION_ORDER[b.currentCongestion] ?? 0) -
          (CONGESTION_ORDER[a.currentCongestion] ?? 0)
      )
      .slice(0, 3)
      .map((s) => ({ name: s.name, congestion: s.currentCongestion }))

    // Fetch worst prediction (highest predicted congestion level)
    const predictions = await prisma.congestionPrediction.findMany({
      orderBy: { predictedAt: 'desc' },
      include: { segment: { select: { name: true } } },
    })

    const worstPrediction = predictions.sort(
      (a, b) =>
        (CONGESTION_ORDER[b.predictedLevel] ?? 0) -
        (CONGESTION_ORDER[a.predictedLevel] ?? 0)
    )[0]

    const worstPredictedSegment = worstPrediction?.segment?.name ?? 'None'

    // Count active incidents
    const incidentCount = await prisma.incident.count({
      where: { status: 'Active' },
    })

    // Get current simulated time
    const { simulatedTime } = simulationEngine.getState()

    // Build prompt
    const prompt = buildInsightPrompt({
      simulatedTime,
      topSegments,
      incidentCount,
      worstPredictedSegment,
      trigger,
    })

    // Call Ollama (non-streaming — emit full response as single token)
    const text = await ollamaGenerate(prompt)

    if (text === null) {
      // Ollama unavailable
      emitSSE('ai:insight_error', {
        insightId,
        message: 'AI Analyst offline — operating in manual mode',
        offline: true,
      })
      return
    }

    // Emit the full response as a single token (ollamaGenerate doesn't stream)
    emitSSE('ai:token', { token: text, insightId })

    // Emit completion
    emitSSE('ai:insight_complete', { insightId, text })
  } catch (error) {
    console.error('[AI Insight] Generation error:', error)
    emitSSE('ai:insight_error', {
      insightId,
      message: error instanceof Error ? error.message : 'Unknown error',
      offline: false,
    })
  }
}
