/**
 * Unit tests and property-based tests for buildInsightPrompt()
 * Requirements: 13.3, 13.4
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildInsightPrompt } from '@/lib/ai/insightPrompt'

const baseParams = {
  simulatedTime: '08:30',
  topSegments: [
    { name: 'Central Boulevard', congestion: 'Gridlock' },
    { name: 'Market Street', congestion: 'Heavy' },
    { name: 'Station Avenue', congestion: 'Moderate' },
  ],
  incidentCount: 4,
  worstPredictedSegment: 'Airport Expressway',
  trigger: 'manual' as const,
}

describe('buildInsightPrompt — unit tests', () => {
  it('contains the simulated time', () => {
    const prompt = buildInsightPrompt(baseParams)
    expect(prompt).toContain('08:30')
  })

  it('contains all top segment names', () => {
    const prompt = buildInsightPrompt(baseParams)
    expect(prompt).toContain('Central Boulevard')
    expect(prompt).toContain('Market Street')
    expect(prompt).toContain('Station Avenue')
  })

  it('contains the incident count', () => {
    const prompt = buildInsightPrompt(baseParams)
    expect(prompt).toContain('4')
  })

  it('contains the worst predicted segment name', () => {
    const prompt = buildInsightPrompt(baseParams)
    expect(prompt).toContain('Airport Expressway')
  })

  it('handles fewer than 3 segments gracefully', () => {
    const prompt = buildInsightPrompt({
      ...baseParams,
      topSegments: [{ name: 'North Ring Road', congestion: 'Heavy' }],
    })
    expect(prompt).toContain('North Ring Road')
    expect(prompt).toContain('08:30')
    expect(prompt).toContain('4')
    expect(prompt).toContain('Airport Expressway')
  })

  it('handles zero segments gracefully', () => {
    const prompt = buildInsightPrompt({ ...baseParams, topSegments: [] })
    expect(prompt).toContain('08:30')
    expect(prompt).toContain('4')
    expect(prompt).toContain('Airport Expressway')
  })

  it('only uses the first 3 segments when more are provided', () => {
    const prompt = buildInsightPrompt({
      ...baseParams,
      topSegments: [
        { name: 'Seg A', congestion: 'Gridlock' },
        { name: 'Seg B', congestion: 'Heavy' },
        { name: 'Seg C', congestion: 'Moderate' },
        { name: 'Seg D', congestion: 'Free' },
      ],
    })
    expect(prompt).toContain('Seg A')
    expect(prompt).toContain('Seg B')
    expect(prompt).toContain('Seg C')
    expect(prompt).not.toContain('Seg D')
  })
})

describe('buildInsightPrompt — property-based tests', () => {
  /**
   * Property 7: AI insight prompt contains required context fields
   * Validates: Requirements 13.3
   */
  it('Property 7: AI insight prompt contains required context fields', () => {
    // Feature: stms-simulation-refactor, Property 7: AI insight prompt contains required context fields
    const congestionLevel = fc.constantFrom('Free', 'Moderate', 'Heavy', 'Gridlock')
    const segmentName = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0)
    const segment = fc.record({ name: segmentName, congestion: congestionLevel })

    const simulatedTime = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

    fc.assert(
      fc.property(
        fc.array(segment, { minLength: 3, maxLength: 10 }),
        fc.integer({ min: 0, max: 50 }),
        segmentName,
        simulatedTime,
        fc.constantFrom('scheduled', 'scenario', 'gridlock_alert', 'manual'),
        (segments, incidentCount, worstPredictedSegment, time, trigger) => {
          const prompt = buildInsightPrompt({
            simulatedTime: time,
            topSegments: segments,
            incidentCount,
            worstPredictedSegment,
            trigger: trigger as 'scheduled' | 'scenario' | 'gridlock_alert' | 'manual',
          })

          // Must contain simulated time
          if (!prompt.includes(time)) return false

          // Must contain at least the first segment name (top 3 are included)
          const top3 = segments.slice(0, 3)
          for (const seg of top3) {
            if (!prompt.includes(seg.name)) return false
          }

          // Must contain incident count
          if (!prompt.includes(String(incidentCount))) return false

          // Must contain worst predicted segment name
          if (!prompt.includes(worstPredictedSegment)) return false

          return true
        }
      ),
      { numRuns: 200 }
    )
  })
})
