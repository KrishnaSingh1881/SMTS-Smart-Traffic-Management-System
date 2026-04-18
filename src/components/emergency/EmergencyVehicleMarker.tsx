'use client'

/**
 * EmergencyVehicleMarker component
 * Renders an SVG ambulance icon marker on the map at the current intersection position.
 * Subscribes to simulation:emergency_update SSE events to update position.
 * Requirements: 17.2
 */

import { useEffect, useRef } from 'react'
import { useMapProvider } from '@/contexts/MapProviderContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntersectionData {
  id: string
  latitude: number
  longitude: number
}

interface SignalWithIntersection {
  id: string
  intersection: IntersectionData
}

interface EmergencyUpdatePayload {
  vehicleId: string
  state: 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
  route: string[]
  currentIndex: number
  preemptedSignalIds: string[]
  completed?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_ID = 'emergency-vehicle-source'
const LAYER_ID = 'emergency-vehicle-layer'

// SVG ambulance icon encoded as a data URL for use as a map image
const AMBULANCE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
  <text x="16" y="21" text-anchor="middle" font-size="16" fill="white">🚑</text>
</svg>`

const AMBULANCE_IMAGE_ID = 'emergency-vehicle-icon'

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmergencyVehicleMarker() {
  const map = useMapProvider()
  // Cache intersection lat/lng by id
  const intersectionCacheRef = useRef<Map<string, IntersectionData>>(new Map())
  const initializedRef = useRef(false)
  const imageLoadedRef = useRef(false)

  // Fetch all intersections once on mount and cache them
  useEffect(() => {
    if (!map) return

    let mounted = true

    async function init() {
      try {
        const res = await fetch('/api/signals')
        if (!res.ok || !mounted) return

        const signals: SignalWithIntersection[] = await res.json()
        if (!mounted) return

        for (const signal of signals) {
          if (signal.intersection) {
            intersectionCacheRef.current.set(signal.intersection.id, signal.intersection)
          }
        }
      } catch {
        // Non-fatal — marker will just not move if cache is empty
      }

      if (!mounted) return

      // Add GeoJSON source (empty initially)
      try {
        map!.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
      } catch {
        // Source may already exist
      }

      // Load ambulance image then add symbol layer
      await loadAmbulanceImage(map!)

      try {
        map!.addLayer({
          id: LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': AMBULANCE_IMAGE_ID,
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
      } catch {
        // Layer may already exist
      }

      initializedRef.current = true
    }

    init()

    return () => {
      mounted = false
      initializedRef.current = false
      imageLoadedRef.current = false
      try { map.removeLayer(LAYER_ID) } catch { /* already removed */ }
      try { map.removeSource(SOURCE_ID) } catch { /* already removed */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Subscribe to SSE for emergency updates
  useEffect(() => {
    if (!map) return

    const es = new EventSource('/api/simulation/stream')

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: string; data: unknown }
        if (parsed.type !== 'simulation:emergency_update') return

        const update = parsed.data as EmergencyUpdatePayload
        if (!update?.vehicleId) return

        // On completion or cancellation, remove the marker
        if (update.completed || update.state === 'COMPLETED' || update.state === 'CANCELLED') {
          updateMarkerPosition(map!, null)
          return
        }

        // Get current intersection from route
        const intersectionId = update.route?.[update.currentIndex]
        if (!intersectionId) return

        const intersection = intersectionCacheRef.current.get(intersectionId)
        if (!intersection) return

        updateMarkerPosition(map!, [
          Number(intersection.longitude),
          Number(intersection.latitude),
        ])
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Update the GeoJSON source to move the marker to a new position,
 * or clear it when position is null.
 */
function updateMarkerPosition(
  map: NonNullable<ReturnType<typeof useMapProvider>>,
  coordinates: [number, number] | null,
) {
  try {
    const source = (map as unknown as {
      getSource?: (id: string) => { setData?: (data: object) => void } | undefined
    }).getSource?.(SOURCE_ID)

    if (source?.setData) {
      if (coordinates) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates },
              properties: {},
            },
          ],
        })
      } else {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
    }
  } catch {
    // Map may not be ready
  }
}

/**
 * Load the ambulance SVG as a map image.
 * Falls back to a simple circle if image loading fails.
 */
async function loadAmbulanceImage(
  map: NonNullable<ReturnType<typeof useMapProvider>>,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const img = new Image(32, 32)
      const blob = new Blob([AMBULANCE_SVG], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      img.onload = () => {
        try {
          // MapLibre/Mapbox addImage via underlying map instance
          const rawMap = map as unknown as {
            addImage?: (id: string, img: HTMLImageElement) => void
            hasImage?: (id: string) => boolean
          }
          if (rawMap.hasImage?.(AMBULANCE_IMAGE_ID)) {
            URL.revokeObjectURL(url)
            resolve()
            return
          }
          rawMap.addImage?.(AMBULANCE_IMAGE_ID, img)
        } catch {
          // Ignore
        }
        URL.revokeObjectURL(url)
        resolve()
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve()
      }

      img.src = url
    } catch {
      resolve()
    }
  })
}
