'use client'

/**
 * InstitutionLayer — renders labelled institution markers on the Meridian City map.
 * These are fixed fictional landmarks that give the city character.
 */

import { useEffect } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'

interface Institution {
  id: string
  name: string
  type: 'hospital' | 'university' | 'stadium' | 'airport' | 'station' | 'port' | 'tech' | 'civic' | 'market'
  coordinates: [number, number]
}

const INSTITUTIONS: Institution[] = [
  { id: 'sula',        name: 'Sula Vineyards',            type: 'market',      coordinates: [73.7150, 20.0075] },
  { id: 'mall',        name: 'City Centre Mall',          type: 'market',      coordinates: [73.7715, 19.9985] },
  { id: 'station',     name: 'Nashik Road Station',       type: 'station',     coordinates: [73.8185, 19.9450] },
  { id: 'muktidham',   name: 'Muktidham Temple',          type: 'civic',       coordinates: [73.8170, 19.9470] },
  { id: 'pandavleni',  name: 'Pandavleni Caves',          type: 'civic',       coordinates: [73.7485, 19.9620] },
  { id: 'kalaram',     name: 'Kalaram Temple',            type: 'civic',       coordinates: [73.7915, 20.0085] },
  { id: 'panchavati',  name: 'Panchavati (Godavari)',     type: 'civic',       coordinates: [73.7930, 20.0070] },
  { id: 'college',     name: 'BHK University (Nashik)',  type: 'university',  coordinates: [73.7650, 20.0050] },
  { id: 'hospital',    name: 'Apollo Hospital Nashik',    type: 'hospital',    coordinates: [73.8050, 19.9850] },
]

const TYPE_ICONS: Record<Institution['type'], string> = {
  hospital:   '🏥',
  university: '🎓',
  stadium:    '🏟️',
  airport:    '✈️',
  station:    '🚉',
  port:       '⚓',
  tech:       '💻',
  civic:      '🏛️',
  market:     '🛒',
}

const SOURCE_ID = 'institutions-source'
const LAYER_CIRCLES = 'institutions-circles'
const LAYER_LABELS  = 'institutions-labels'

export default function InstitutionLayer() {
  const map = useMapProvider()

  useEffect(() => {
    if (!map) return

    async function init() {
      await map.waitForLoad()

      const geojson = {
      type: 'FeatureCollection' as const,
      features: INSTITUTIONS.map((inst) => ({
        type: 'Feature' as const,
        id: inst.id,
        properties: {
          name: inst.name,
          icon: TYPE_ICONS[inst.type],
          type: inst.type,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: inst.coordinates,
        },
      })),
    }

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: geojson,
    })

    // Glowing dot behind the icon
    map.addLayer({
      id: LAYER_CIRCLES,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': 10,
        'circle-color': '#1e293b',
        'circle-stroke-color': '#60a5fa',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.85,
      },
    })

    // Institution name label below the dot
    map.addLayer({
      id: LAYER_LABELS,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'text-field': ['concat', ['get', 'icon'], '  ', ['get', 'name']],
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#cbd5e1',
        'text-halo-color': '#0f1117',
        'text-halo-width': 2,
      },
    })

    init()

    return () => {
      try { map.removeLayer(LAYER_LABELS) }  catch { /* ok */ }
      try { map.removeLayer(LAYER_CIRCLES) } catch { /* ok */ }
      try { map.removeSource(SOURCE_ID) }    catch { /* ok */ }
    }
  }, [map])

  return null
}
