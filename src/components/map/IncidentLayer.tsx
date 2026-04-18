'use client'

import { useEffect, useRef, useState } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'
import type { MapMouseEvent } from '../../lib/map/IMapProvider'

interface IncidentLayerProps {
  visible: boolean
}

interface IncidentData {
  id: string
  type: string
  severity: number
  description: string | null
  createdAt: string
  segment: {
    id: string
    name: string
    geometry: string | null
  }
}

interface SelectedIncident {
  id: string
  type: string
  severity: number
  description: string | null
  createdAt: string
  segmentName: string
  screenX: number
  screenY: number
}

const SOURCE_ID = 'incidents-source'
const LAYER_ID = 'incidents-layer'

/** Compute midpoint of a GeoJSON LineString coordinate array */
function getMidpoint(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) return [0, 0]
  if (coordinates.length === 1) return coordinates[0]
  const mid = Math.floor(coordinates.length / 2)
  return coordinates[mid]
}

/** Parse segment geometry and return a midpoint coordinate */
function getSegmentMidpoint(geometryStr: string | null): [number, number] | null {
  if (!geometryStr) return null
  try {
    const geom = JSON.parse(geometryStr)
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
      return getMidpoint(geom.coordinates as [number, number][])
    }
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      return geom.coordinates as [number, number]
    }
  } catch {
    // ignore parse errors
  }
  return null
}

/** Map severity to circle color */
function severityColor(severity: number): string {
  if (severity >= 3) return '#ef4444' // red
  if (severity === 2) return '#f97316' // orange
  return '#eab308' // yellow
}

/** Format elapsed time since createdAt */
function timeElapsed(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function IncidentLayer({ visible }: IncidentLayerProps) {
  const map = useMapProvider()
  const clickHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null)
  const initializedRef = useRef(false)
  const [selected, setSelected] = useState<SelectedIncident | null>(null)

  useEffect(() => {
    if (!map) return

    let mounted = true

    async function init() {
      await map!.waitForLoad()
      if (!mounted) return

      const res = await fetch('/api/incidents?status=Active')
      if (!res.ok || !mounted) return

      const incidents: IncidentData[] = await res.json()
      if (!mounted) return

      const features = incidents
        .map((inc) => {
          const coords = getSegmentMidpoint(inc.segment?.geometry ?? null)
          if (!coords) return null
          return {
            type: 'Feature' as const,
            id: inc.id,
            properties: {
              type: inc.type,
              severity: inc.severity,
              description: inc.description ?? '',
              createdAt: inc.createdAt,
              segmentName: inc.segment?.name ?? '',
              color: severityColor(inc.severity),
            },
            geometry: {
              type: 'Point' as const,
              coordinates: coords,
            },
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
        type: 'circle',
        source: SOURCE_ID,
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      const clickHandler = (e: MapMouseEvent) => {
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties as Record<string, unknown>
        setSelected({
          id: String(feature.id ?? props.id ?? ''),
          type: String(props.type ?? ''),
          severity: Number(props.severity ?? 0),
          description: props.description ? String(props.description) : null,
          createdAt: String(props.createdAt ?? ''),
          segmentName: String(props.segmentName ?? ''),
          screenX: e.point.x,
          screenY: e.point.y,
        })
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
        console.warn('[IncidentLayer] Failed to toggle visibility:', err)
      }
    }
  }, [map, visible])

  if (!selected) return null

  return (
    <div
      style={{ left: selected.screenX + 12, top: selected.screenY - 8 }}
      className="absolute z-50 w-64 rounded-lg bg-white shadow-lg border border-gray-200 p-3 text-sm"
    >
      <button
        onClick={() => setSelected(null)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 leading-none"
        aria-label="Close"
      >
        ✕
      </button>
      <p className="font-semibold text-gray-800 mb-1">{selected.type.replace('_', ' ')}</p>
      <p className="text-gray-500 text-xs mb-2">{selected.segmentName}</p>
      <div className="space-y-1 text-gray-700">
        <div className="flex justify-between">
          <span className="text-gray-500">Severity</span>
          <span className="font-medium">{selected.severity} / 5</span>
        </div>
        {selected.description && (
          <div>
            <span className="text-gray-500">Description</span>
            <p className="mt-0.5 text-xs">{selected.description}</p>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Reported</span>
          <span>{timeElapsed(selected.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}
