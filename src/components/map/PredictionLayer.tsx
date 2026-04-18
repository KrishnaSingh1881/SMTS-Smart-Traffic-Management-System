'use client'

import { useEffect, useRef } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'

interface PredictionLayerProps {
  visible: boolean
}

interface PredictionData {
  id: string
  segmentId: string
  segmentName: string
  predictedLevel: string
  targetWindowMinutes: number
  confidenceScore: number
  predictedAt: string
}

interface SegmentData {
  id: string
  geometry?: string | null
}

const SOURCE_ID = 'predictions-source'
const LAYER_ID = 'predictions-layer'

const CONGESTION_COLORS: Record<string, string> = {
  Free: '#22c55e',
  Moderate: '#eab308',
  Heavy: '#f97316',
  Gridlock: '#ef4444',
}

export default function PredictionLayer({ visible }: PredictionLayerProps) {
  const map = useMapProvider()
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!map) return

    let mounted = true

    async function init() {
      await map!.waitForLoad()
      if (!mounted) return

      // Fetch predictions and segments in parallel
      const [predsRes, segsRes] = await Promise.all([
        fetch('/api/predictions'),
        fetch('/api/monitoring/segments'),
      ])

      if (!predsRes.ok || !segsRes.ok || !mounted) return

      const predictions: PredictionData[] = await predsRes.json()
      const segments: SegmentData[] = await segsRes.json()

      if (!mounted) return

      // Build a map of segmentId -> geometry string
      const geometryMap = new Map<string, string>()
      for (const seg of segments) {
        if (seg.geometry) {
          geometryMap.set(seg.id, seg.geometry)
        }
      }

      // Filter to 60-minute window predictions and build GeoJSON features
      const features = predictions
        .filter((pred) => pred.targetWindowMinutes === 60)
        .map((pred) => {
          const geometryStr = geometryMap.get(pred.segmentId)
          if (!geometryStr) return null
          let geometry: object
          try {
            geometry = JSON.parse(geometryStr)
          } catch {
            return null
          }
          return {
            type: 'Feature' as const,
            id: pred.id,
            properties: {
              predictedLevel: pred.predictedLevel,
              segmentId: pred.segmentId,
            },
            geometry,
          }
        })
        .filter(Boolean) as GeoJSON.Feature[]

      const geojson = { type: 'FeatureCollection' as const, features }

      map!.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        promoteId: 'id',
      } as Parameters<typeof map.addSource>[1])

      map!.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'predictedLevel'],
            'Free', CONGESTION_COLORS.Free,
            'Moderate', CONGESTION_COLORS.Moderate,
            'Heavy', CONGESTION_COLORS.Heavy,
            'Gridlock', CONGESTION_COLORS.Gridlock,
            CONGESTION_COLORS.Free,
          ],
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
          'line-width': 4,
        },
      })

      initializedRef.current = true
    }

    init()

    return () => {
      mounted = false
      initializedRef.current = false

      try { map.removeLayer(LAYER_ID) } catch { /* already removed */ }
      try { map.removeSource(SOURCE_ID) } catch { /* already removed */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Toggle visibility when `visible` prop changes
  useEffect(() => {
    if (!map || !initializedRef.current) return
    if (map.isReady()) {
      try {
        map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
      } catch (err) {
        console.warn('[PredictionLayer] Failed to toggle visibility:', err)
      }
    }
  }, [map, visible])

  return null
}
