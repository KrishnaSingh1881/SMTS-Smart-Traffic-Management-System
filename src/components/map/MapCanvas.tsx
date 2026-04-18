'use client'

import { useRef, useEffect, useState } from 'react'
import { createMapProvider } from '../../lib/map/MapProviderFactory'
import { MapProviderContext } from '../../contexts/MapProviderContext'
import type { IMapProvider, MapInitOptions } from '../../lib/map/IMapProvider'

const defaultOptions: MapInitOptions = {
  center: [73.7898, 19.9975], // Nashik, Maharashtra
  zoom: 13,
}

interface MapCanvasProps {
  className?: string
  children?: React.ReactNode
}

export default function MapCanvas({ className, children }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<IMapProvider | null>(null)
  const [provider, setProvider] = useState<IMapProvider | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const instance = createMapProvider(containerRef.current, defaultOptions)
    providerRef.current = instance

    // Only expose the provider to children after the style has fully loaded
    // This prevents "Style is not done loading" errors in layer components
    const resizeTimer = setTimeout(() => instance.resize(), 0)
    instance.waitForLoad().then(() => {
      if (providerRef.current === instance) {
        setProvider(instance)
      }
    })

    return () => {
      clearTimeout(resizeTimer)
      instance.remove()
      providerRef.current = null
      setProvider(null)
    }
  }, [])

  return (
    <MapProviderContext.Provider value={provider}>
      <div className={`relative w-full h-full ${className ?? ''}`}>
        {/* Map canvas — fills the container absolutely so children don't push it */}
        <div ref={containerRef} className="absolute inset-0" />
        {/* Overlay children rendered on top of the map */}
        {children}
      </div>
    </MapProviderContext.Provider>
  )
}
