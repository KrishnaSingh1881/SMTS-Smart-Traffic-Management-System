'use client'

import { useEffect } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'

const INSTITUTIONS = [
  { id: 'hospital',   name: 'Meridian General Hospital', icon: '🏥', coordinates: [73.795, 18.508] as [number, number] },
  { id: 'university', name: 'Meridian University',       icon: '🎓', coordinates: [73.815, 18.515] as [number, number] },
  { id: 'stadium',    name: 'City Stadium',              icon: '🏟', coordinates: [73.810, 18.480] as [number, number] },
  { id: 'airport',    name: 'Meridian Airport',          icon: '✈',  coordinates: [73.740, 18.550] as [number, number] },
  { id: 'station',    name: 'Central Station',           icon: '🚉', coordinates: [73.795, 18.495] as [number, number] },
  { id: 'port',       name: 'Meridian Port',             icon: '⚓', coordinates: [73.840, 18.470] as [number, number] },
  { id: 'techpark',   name: 'Tech Park',                 icon: '💻', coordinates: [73.770, 18.525] as [number, number] },
  { id: 'civic',      name: 'Civic Centre',              icon: '🏛', coordinates: [73.790, 18.505] as [number, number] },
  { id: 'market',     name: 'Central Market',            icon: '🛒', coordinates: [73.805, 18.496] as [number, number] },
]

const SRC = 'institutions-source'
const CIRCLES = 'institutions-circles'
const LABELS = 'institutions-labels'

export default function InstitutionLayer() {
  const map = useMapProvider()

  useEffect(() => {
    if (!map) return

    let cancelled = false

    map.waitForLoad().then(() => {
      if (cancelled) return

      map.addSource(SRC, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: INSTITUTIONS.map((inst) => ({
            type: 'Feature',
            id: inst.id,
            properties: { name: inst.name, icon: inst.icon },
            geometry: { type: 'Point', coordinates: inst.coordinates },
          })),
        },
      })

      map.addLayer({
        id: CIRCLES,
        type: 'circle',
        source: SRC,
        paint: {
          'circle-radius': 10,
          'circle-color': '#1e293b',
          'circle-stroke-color': '#60a5fa',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.85,
        },
      })

      map.addLayer({
        id: LABELS,
        type: 'symbol',
        source: SRC,
        layout: {
          'text-field': ['concat', ['get', 'icon'], '  ', ['get', 'name']],
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#cbd5e1',
          'text-halo-color': '#0f1117',
          'text-halo-width': 2,
        },
      })
    })

    return () => {
      cancelled = true
      try { map.removeLayer(LABELS) } catch (e) { void e }
      try { map.removeLayer(CIRCLES) } catch (e) { void e }
      try { map.removeSource(SRC) } catch (e) { void e }
    }
  }, [map])

  return null
}
