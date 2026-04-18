'use client'

import { useEffect, useRef } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'
import type { MapMouseEvent } from '../../lib/map/IMapProvider'

interface SegmentLayerProps {
  onSegmentClick?: (segmentId: string) => void
  onSegmentContextMenu?: (segmentId: string, position: { x: number; y: number }) => void
}

interface SegmentData {
  id: string
  name: string
  currentCongestion: string
  vehicleCount?: number
  geometry?: string
}

const CONGESTION_COLORS: Record<string, string> = {
  Free: '#22c55e',
  Moderate: '#eab308',
  Heavy: '#f97316',
  Gridlock: '#ef4444',
}

const SOURCE_ID = 'segments-source'
const LAYER_ID = 'segments-layer'

interface SegmentUpdateData {
  segmentId: string
  vehicleCount: number
  avgSpeedKmh: number
  congestionLevel: string
  lastObservationAt: string
}

export default function SegmentLayer({ onSegmentClick, onSegmentContextMenu }: SegmentLayerProps) {
  const map = useMapProvider()
  const clickHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null)
  const contextMenuHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null)

  useEffect(() => {
    if (!map) return

    let mounted = true

    async function init() {
      // Wait for map to be ready before adding sources/layers
      await map!.waitForLoad()
      if (!mounted) return

      const res = await fetch('/api/monitoring/segments')
      if (!res.ok || !mounted) return

      const segments: SegmentData[] = await res.json()

      console.log(`[SegmentLayer] Initializing with ${segments.length} segments`);

      if (!mounted) return

      // Build GeoJSON FeatureCollection
      const features = segments
        .filter((seg) => {
          if (!seg.geometry) {
            console.warn(`[SegmentLayer] Segment ${seg.id} has no geometry`);
            return false
          }
          try {
            JSON.parse(seg.geometry)
            return true
          } catch (e) {
            console.error(`[SegmentLayer] Failed to parse geometry for segment ${seg.id}:`, seg.geometry);
            return false
          }
        })
        .map((seg) => {
          const geometry = JSON.parse(seg.geometry!)
          return {
            type: 'Feature' as const,
            id: seg.id,
            properties: {
              id: seg.id,
              congestion: seg.currentCongestion ?? 'Free',
              vehicleCount: seg.vehicleCount ?? 0,
              name: seg.name,
            },
            geometry,
          }
        })

      console.log(`[SegmentLayer] Built ${features.length} GeoJSON features`);

      const geojson = {
        type: 'FeatureCollection' as const,
        features,
      }

      // Add source
      try {
        map!.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geojson,
          promoteId: 'id',
        } as Parameters<typeof map.addSource>[1])
      } catch (err) {
        console.error('[SegmentLayer] addSource failed:', err);
      }

      // Add line layer — colour driven by feature-state so SSE updates work instantly
      try {
        map!.addLayer({
          id: LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['feature-state', 'congestion'], 'Gridlock'], CONGESTION_COLORS.Gridlock,
              ['==', ['feature-state', 'congestion'], 'Heavy'],    CONGESTION_COLORS.Heavy,
              ['==', ['feature-state', 'congestion'], 'Moderate'], CONGESTION_COLORS.Moderate,
              // fallback: use the property baked in at load time
              ['match',
                ['get', 'congestion'],
                'Gridlock', CONGESTION_COLORS.Gridlock,
                'Heavy',    CONGESTION_COLORS.Heavy,
                'Moderate', CONGESTION_COLORS.Moderate,
                CONGESTION_COLORS.Free,
              ],
            ],
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      } catch (err) {
        console.error('[SegmentLayer] addLayer failed:', err);
      }

      // Add a glow layer for Gridlock segments
      try {
        map!.addLayer({
          id: LAYER_ID + '-glow',
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': CONGESTION_COLORS.Gridlock,
            'line-width': [
              'case',
              ['==', ['feature-state', 'congestion'], 'Gridlock'], 18,
              ['==', ['get', 'congestion'], 'Gridlock'], 18,
              0,
            ],
            'line-opacity': 0.15,
            'line-blur': 6,
          },
        })
      } catch (err) {
        console.error('[SegmentLayer] addLayer-glow failed:', err);
      }

      // Apply pulse feature state to Gridlock segments
      for (const seg of segments) {
        try {
          if (!map!.hasSource(SOURCE_ID)) break
          
          if (seg.currentCongestion === 'Gridlock') {
            map!.setFeatureState(
              { id: seg.id, source: SOURCE_ID },
              { pulse: true, congestion: 'Gridlock' }
            )
          } else {
            map!.setFeatureState(
              { id: seg.id, source: SOURCE_ID },
              { congestion: seg.currentCongestion, vehicleCount: seg.vehicleCount ?? 0 }
            )
          }
        } catch (err) {
          console.error(`[SegmentLayer] setFeatureState failed for ${seg.id}:`, err);
        }
      }

      // Road name labels along the lines
      map!.addLayer({
        id: LAYER_ID + '-labels',
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-max-angle': 30,
          'text-offset': [0, -0.8],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#94a3b8',
          'text-halo-color': '#0f1117',
          'text-halo-width': 1.5,
        },
      })

      // Click handler
      const clickHandler = (e: MapMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const segmentId = feature.id != null
          ? String(feature.id)
          : String(feature.properties?.id ?? '')
        if (segmentId && onSegmentClick) {
          onSegmentClick(segmentId)
        }
      }
      clickHandlerRef.current = clickHandler
      map!.on('click', LAYER_ID, clickHandler)

      // Context menu handler
      const contextMenuHandler = (e: MapMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const segmentId = feature.id != null
          ? String(feature.id)
          : String(feature.properties?.id ?? '')
        if (segmentId && onSegmentContextMenu) {
          onSegmentContextMenu(segmentId, {
            x: e.point.x,
            y: e.point.y,
          })
        }
      }
      contextMenuHandlerRef.current = contextMenuHandler
      map!.on('contextmenu', LAYER_ID, contextMenuHandler)
    }

    init()

    return () => {
      mounted = false

      // Remove event handlers
      if (clickHandlerRef.current) {
        map.off('click', LAYER_ID, clickHandlerRef.current)
        clickHandlerRef.current = null
      }
      if (contextMenuHandlerRef.current) {
        map.off('contextmenu', LAYER_ID, contextMenuHandlerRef.current)
        contextMenuHandlerRef.current = null
      }

      // Remove layer and source
      try { map.removeLayer(LAYER_ID + '-labels') } catch { /* already removed */ }
      try { map.removeLayer(LAYER_ID + '-glow') } catch { /* already removed */ }
      try { map.removeLayer(LAYER_ID) } catch { /* already removed */ }
      try { map.removeSource(SOURCE_ID) } catch { /* already removed */ }
    }
  }, [map, onSegmentClick, onSegmentContextMenu])

  // Subscribe to SSE stream for real-time segment updates (Req 3.8)
  useEffect(() => {
    if (!map) return

    const es = new EventSource('/api/monitoring/sse')

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: string; data: unknown }
        if (parsed.type !== 'segment:update') return

        const update = parsed.data as SegmentUpdateData
        if (!update?.segmentId) return

        if (map.hasSource(SOURCE_ID)) {
          map.setFeatureState(
            { source: SOURCE_ID, id: update.segmentId },
            {
              congestion: update.congestionLevel,
              vehicleCount: update.vehicleCount,
            }
          )
        }
      } catch {
        // Ignore malformed events
      }
    }

    return () => {
      es.close()
    }
  }, [map])

  return null
}
