'use client'

import { useEffect, useRef } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'
import type { MapMouseEvent } from '../../lib/map/IMapProvider'

interface SignalLayerProps {
  visible: boolean
  onIntersectionClick?: (intersectionId: string) => void
}

interface SignalData {
  id: string
  label: string
  currentPhase: string
  intersection: {
    id: string
    name: string
    latitude: number
    longitude: number
  }
}

const PHASE_COLORS: Record<string, string> = {
  Green: '#22c55e',
  Yellow: '#eab308',
  Red: '#ef4444',
  Off: '#64748b',
}

const SOURCE_ID = 'signals-source'
const LAYER_ID = 'signals-layer'
const PULSE_LAYER_ID = 'signals-pulse-layer'

export default function SignalLayer({ visible, onIntersectionClick }: SignalLayerProps) {
  const map = useMapProvider()
  const clickHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null)
  const initializedRef = useRef(false)

  // Initialize layers on mount
  useEffect(() => {
    if (!map) return

    let mounted = true

    async function init() {
      await map!.waitForLoad()
      if (!mounted) return

      const res = await fetch('/api/signals')
      if (!res.ok || !mounted) return

      const signals: SignalData[] = await res.json()
      if (!mounted) return

      const features = signals
        .filter((s) => s.intersection?.latitude != null && s.intersection?.longitude != null)
        .map((s) => ({
          type: 'Feature' as const,
          id: s.id,
          properties: {
            phase: s.currentPhase ?? 'Off',
            intersectionId: s.intersection.id,
            label: s.label,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [Number(s.intersection.longitude), Number(s.intersection.latitude)],
          },
        }))

      const geojson = { type: 'FeatureCollection' as const, features }

      map!.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        promoteId: 'id',
      } as Parameters<typeof map.addSource>[1])

      // Main circle layer
      map!.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'circle-color': [
            'match',
            ['get', 'phase'],
            'Green', PHASE_COLORS.Green,
            'Yellow', PHASE_COLORS.Yellow,
            'Red', PHASE_COLORS.Red,
            PHASE_COLORS.Off,
          ],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Pulse layer (larger, lower opacity for animation effect)
      map!.addLayer({
        id: PULSE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'circle-color': [
            'match',
            ['get', 'phase'],
            'Green', PHASE_COLORS.Green,
            'Yellow', PHASE_COLORS.Yellow,
            'Red', PHASE_COLORS.Red,
            PHASE_COLORS.Off,
          ],
          'circle-radius': 14,
          'circle-opacity': 0.3,
          'circle-stroke-width': 0,
        },
      })

      // Click handler
      const clickHandler = (e: MapMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const intersectionId = String(feature.properties?.intersectionId ?? '')
        if (intersectionId && onIntersectionClick) {
          onIntersectionClick(intersectionId)
        }
      }
      clickHandlerRef.current = clickHandler
      map!.on('click', LAYER_ID, clickHandler)

      initializedRef.current = true
    }

    init()

    return () => {
      mounted = false
      initializedRef.current = false

      if (clickHandlerRef.current) {
        map.off('click', LAYER_ID, clickHandlerRef.current)
        clickHandlerRef.current = null
      }

      try { map.removeLayer(PULSE_LAYER_ID) } catch { /* already removed */ }
      try { map.removeLayer(LAYER_ID) } catch { /* already removed */ }
      try { map.removeSource(SOURCE_ID) } catch { /* already removed */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Toggle visibility when `visible` prop changes
  useEffect(() => {
    if (!map || !initializedRef.current) return
    const value = visible ? 'visible' : 'none'
    if (map.isReady()) {
      try {
        map.setLayoutProperty(LAYER_ID, 'visibility', value)
        map.setLayoutProperty(PULSE_LAYER_ID, 'visibility', value)
      } catch (err) {
        console.warn('[SignalLayer] Failed to toggle visibility:', err)
      }
    }
  }, [map, visible])

  return null
}
