import maplibregl from 'maplibre-gl'
import type {
  IMapProvider,
  MapInitOptions,
  GeoJSONSourceSpecification,
  LayerSpecification,
  FeatureIdentifier,
  FlyToOptions,
  MapMouseEvent,
} from './IMapProvider'

// Professional dark-themed style from OpenFreeMap
const EXTERNAL_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

// Fallback dark style in case the external one is unreachable (e.g. CORS or offline)
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'Fallback Dark',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0f1117' },
    },
  ],
}

/**
 * MapLibre GL JS adapter implementing IMapProvider.
 */
export class MapLibreAdapter implements IMapProvider {
  private map: maplibregl.Map
  private isLoaded: boolean = false

  constructor(container: HTMLElement, options: MapInitOptions) {
    this.map = new maplibregl.Map({
      container,
      style: (options.style as maplibregl.StyleSpecification | string | undefined) ?? EXTERNAL_STYLE_URL,
      center: options.center,
      zoom: options.zoom,
      maxBounds: [
        [73.65, 19.85],  // Nashik SW
        [73.95, 20.15],  // Nashik NE
      ],
      minZoom: 10,
      maxZoom: 18,
    })

    // Error handler for tile loading or style errors
    this.map.on('error', (e) => {
      console.error('[MapLibreAdapter] Map Error:', e)
      // If the style failed to load, try setting the fallback style once
      const currentStyle = this.map.getStyle()
      if (e.error?.message?.includes('style') && (!currentStyle || currentStyle.name !== FALLBACK_STYLE.name)) {
        console.warn('[MapLibreAdapter] Style failed to load. Using fallback dark background.')
        this.map.setStyle(FALLBACK_STYLE)
      }
    })

    const onReady = () => {
      if (!this.isLoaded) {
        this.isLoaded = true
        console.log('[MapLibreAdapter] Map loaded successfully.')
      }
    }

    this.map.once('load', onReady)
    this.map.once('style.load', onReady)
  }

  addSource(id: string, source: GeoJSONSourceSpecification): void {
    try {
      this.map.addSource(id, source as maplibregl.SourceSpecification)
    } catch (err) {
      console.error(`[MapLibreAdapter] addSource(${id}) failed:`, err)
    }
  }

  removeSource(id: string): void {
    try {
      this.map.removeSource(id)
    } catch (err) {
      console.error(`[MapLibreAdapter] removeSource(${id}) failed:`, err)
    }
  }

  addLayer(layer: LayerSpecification): void {
    try {
      this.map.addLayer(layer as maplibregl.LayerSpecification)
    } catch (err) {
      console.error(`[MapLibreAdapter] addLayer(${layer.id}) failed:`, err)
    }
  }

  removeLayer(id: string): void {
    try {
      this.map.removeLayer(id)
    } catch (err) {
      console.error(`[MapLibreAdapter] removeLayer(${id}) failed:`, err)
    }
  }

  setFeatureState(feature: FeatureIdentifier, state: Record<string, unknown>): void {
    try {
      this.map.setFeatureState(feature as maplibregl.FeatureIdentifier, state)
    } catch (err) {
      console.error(`[MapLibreAdapter] setFeatureState failed:`, err)
    }
  }

  flyTo(options: FlyToOptions): void {
    try {
      this.map.flyTo(options as maplibregl.FlyToOptions)
    } catch (err) {
      console.error(`[MapLibreAdapter] flyTo failed:`, err)
    }
  }

  on(event: 'click', layerId: string, handler: (e: MapMouseEvent) => void): void
  on(event: 'contextmenu', layerId: string, handler: (e: MapMouseEvent) => void): void
  on(event: 'click' | 'contextmenu', layerId: string, handler: (e: MapMouseEvent) => void): void {
    try {
      this.map.on(event, layerId, (e: maplibregl.MapMouseEvent) => {
        handler(e as unknown as MapMouseEvent)
      })
    } catch (err) {
      console.error(`[MapLibreAdapter] on(${event}, ${layerId}) failed:`, err)
    }
  }

  off(event: string, layerId: string, handler: (e: MapMouseEvent) => void): void {
    try {
      this.map.off(event, layerId, handler as any)
    } catch (err) {
      console.error(`[MapLibreAdapter] off(${event}, ${layerId}) failed:`, err)
    }
  }

  getCanvas(): HTMLCanvasElement {
    try {
      return this.map.getCanvas()
    } catch (err) {
      console.error(`[MapLibreAdapter] getCanvas failed:`, err)
      return document.createElement('canvas')
    }
  }

  resize(): void {
    try {
      this.map.resize()
    } catch (err) {
      console.error(`[MapLibreAdapter] resize failed:`, err)
    }
  }

  setLayoutProperty(layerId: string, name: string, value: unknown): void {
    try {
      this.map.setLayoutProperty(layerId, name, value)
    } catch (err) {
      console.error(`[MapLibreAdapter] setLayoutProperty(${layerId}, ${name}) failed:`, err)
    }
  }

  hasSource(id: string): boolean {
    try {
      return !!this.map.getSource(id)
    } catch {
      return false
    }
  }

  isReady(): boolean {
    return this.isLoaded || this.map.isStyleLoaded()
  }

  waitForLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isReady()) {
        resolve()
        return
      }

      this.map.once('load', () => {
        this.isLoaded = true
        resolve()
      })
      this.map.once('style.load', () => {
        this.isLoaded = true
        resolve()
      })
      
      // Safety timeout: resolve anyway after 5 seconds so the app doesn't hang
      const timeout = setTimeout(() => {
        console.warn('[MapLibreAdapter] waitForLoad timed out. Force resolving provider.')
        resolve()
      }, 5000)

      this.map.once('load', () => clearTimeout(timeout))
      this.map.once('style.load', () => clearTimeout(timeout))
    })
  }

  remove(): void {
    try {
      this.map.remove()
    } catch (err) {
      console.error(`[MapLibreAdapter] remove failed:`, err)
    }
  }
}
