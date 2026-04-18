'use client'

import { useEffect, useMemo } from 'react'
import { useMapProvider } from '../../contexts/MapProviderContext'

/**
 * UrbanLayer renders a "Synthetic City" backdrop.
 * It adds layers for water, parks, and 3D building extrusions.
 */
export default function UrbanLayer() {
  const map = useMapProvider()

  // Generate synthetic city data centered around Nashik (19.9975, 73.7898)
  const cityData = useMemo(() => {
    const center = [73.7898, 19.9975]
    
    // 1. Godavari River (flows roughly West to East through Nashik)
    const river: GeoJSON.Feature = {
      type: 'Feature',
      properties: { type: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [center[0] - 0.08, center[1] + 0.01],
          [center[0] - 0.02, center[1] + 0.005],
          [center[0] + 0.04, center[1] - 0.015],
          [center[0] + 0.08, center[1] - 0.02],
          [center[0] + 0.08, center[1] - 0.04],
          [center[0] + 0.04, center[1] - 0.035],
          [center[0] - 0.02, center[1] - 0.015],
          [center[0] - 0.08, center[1] - 0.01],
          [center[0] - 0.08, center[1] + 0.01],
        ]]
      }
    }

    // 2. Parks (distributed green areas)
    const parks: GeoJSON.Feature[] = [
      {
        type: 'Feature',
        properties: { type: 'park', name: 'Central Park' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [center[0] - 0.005, center[1] - 0.005],
            [center[0] + 0.005, center[1] - 0.005],
            [center[0] + 0.005, center[1] + 0.005],
            [center[0] - 0.005, center[1] + 0.005],
            [center[0] - 0.005, center[1] - 0.005],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { type: 'park', name: 'North Reserve' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [center[0] + 0.015, center[1] + 0.03],
            [center[0] + 0.025, center[1] + 0.03],
            [center[0] + 0.025, center[1] + 0.04],
            [center[0] + 0.015, center[1] + 0.04],
            [center[0] + 0.015, center[1] + 0.03],
          ]]
        }
      }
    ]

    // 3. Urban Blocks (3D Buildings) - Generated in a grid
    const buildings: GeoJSON.Feature[] = []
    const gridSize = 0.004
    const blockPadding = 0.001
    
    for (let x = -6; x <= 6; x++) {
      for (let y = -6; y <= 6; y++) {
        // Skip some blocks to create a more natural look (and leave space for roads/parks)
        if ((x + y) % 3 === 0) continue
        if (Math.abs(x) < 2 && Math.abs(y) < 2) continue // Leave space for Central Square

        const bx = center[0] + x * gridSize
        const by = center[1] + y * gridSize
        
        // Random height based on distance to center (central business district)
        const dist = Math.sqrt(x*x + y*y)
        const height = Math.max(20, (15 - dist) * 25 + Math.random() * 40)

        buildings.push({
          type: 'Feature',
          properties: { 
            height: height,
            base_height: 0,
            color: dist < 3 ? '#334155' : '#1e293b' // Darker towards outskirts
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [bx + blockPadding, by + blockPadding],
              [bx + gridSize - blockPadding, by + blockPadding],
              [bx + gridSize - blockPadding, by + gridSize - blockPadding],
              [bx + blockPadding, by + gridSize - blockPadding],
              [bx + blockPadding, by + blockPadding],
            ]]
          }
        })
      }
    }

    return {
      type: 'FeatureCollection',
      features: [river, ...parks, ...buildings]
    } as GeoJSON.FeatureCollection
  }, [])

  useEffect(() => {
    if (!map) return

    const setupLayers = async () => {
      await map.waitForLoad()

      // 1. Water Layer
      try {
        map.addSource('urban-features', {
          type: 'geojson',
          data: cityData
        } as any)
      } catch (e) {}

      try {
        map.addLayer({
          id: 'urban-water',
          type: 'fill',
          source: 'urban-features',
          filter: ['==', 'type', 'water'],
          paint: {
            'fill-color': '#112240',
            'fill-opacity': 0.8
          }
        })
      } catch (e) {}

      // 2. Park Layer
      try {
        map.addLayer({
          id: 'urban-parks',
          type: 'fill',
          source: 'urban-features',
          filter: ['==', 'type', 'park'],
          paint: {
            'fill-color': '#064e3b',
            'fill-opacity': 0.6
          }
        })
      } catch (e) {}

      // 3. 3D Buildings
      try {
        map.addLayer({
          id: 'urban-buildings',
          type: 'fill-extrusion',
          source: 'urban-features',
          filter: ['has', 'height'],
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base_height'],
            'fill-extrusion-opacity': 0.9
          }
        })
      } catch (e) {}
    }

    setupLayers()

    return () => {
      try { map.removeLayer('urban-buildings') } catch (e) {}
      try { map.removeLayer('urban-parks') } catch (e) {}
      try { map.removeLayer('urban-water') } catch (e) {}
      try { map.removeSource('urban-features') } catch (e) {}
    }
  }, [map, cityData])

  return null
}
