import type { TriggerType } from '@/lib/simulation/types'

export interface InsightPromptParams {
  simulatedTime: string
  topSegments: Array<{ name: string; congestion: string }>
  incidentCount: number
  worstPredictedSegment: string
  trigger: TriggerType
}

/**
 * Builds a concise AI prompt for traffic insight generation.
 * Prompt is capped at ~400 tokens; response instruction capped at ~200 tokens.
 * Requirements: 13.3, 13.4
 */
export function buildInsightPrompt(params: InsightPromptParams): string {
  const { simulatedTime, topSegments, incidentCount, worstPredictedSegment, trigger } = params

  // Take at most 3 segments
  const segments = topSegments.slice(0, 3)

  const segmentLines = segments.length > 0
    ? segments
        .map((s, i) => `${i + 1}. ${s.name}: ${s.congestion}`)
        .join('\n')
    : '1. No congested segments reported'

  return `You are a traffic analyst for Nashik. Current simulated time: ${simulatedTime}.

Top congested segments:
${segmentLines}

Active incidents: ${incidentCount}
Worst predicted congestion: ${worstPredictedSegment}
Trigger: ${trigger}

Provide a brief traffic situation summary in under 200 tokens. Focus on actionable insights.`
}
