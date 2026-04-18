import mapboxgl from 'mapbox-gl'
import type {
  IMapProvider,
  MapInitOptions,
  GeoJSONSourceSpecification,
  LayerSpecification,
  FeatureIdentifier,
  FlyToOptions,
  MapMouseEvent,
} from './IMapProvider'
import { MapLibreAdapter } from './MapLibreAdapter'

const DEFAULT_STYLE = 'mapbox://styles/mapbox/dark-v11'

/**
 * Mapbox GL JS adapter implementing IMapProvider.
 * On authentication/token errors, silently falls back to MapLibreAdapter.
 * All method calls are wrapped in try/catch — errors are logged and not propagated.
 */
export class MapboxAdapter implements IMapProvider {
  private map: mapboxgl.Map
  private fallback: MapLibreAdapter | null = null
  private container: HTMLElement
  private initOptions: MapInitOptions

  constructor(container: HTMLElement, options: MapInitOptions & { token: string }) {
    this.container = container
    this.initOptions = options

    mapboxgl.accessToken = options.token

    this.map = new mapboxgl.Map({
      container,
      style: options.style ?? DEFAULT_STYLE,
      center: options.center,
      zoom: options.zoom,
    })

    this.map.on('error', (e) => {
      const msg: string = (e as unknown as { error?: { message?: string }; message?: string })
        ?.error?.message ?? (e as unknown as { message?: string })?.message ?? ''
      const isAuthError =
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('invalid token') ||
        msg.toLowerCase().includes('access token') ||
        msg.toLowerCase().includes('401')

      if (isAuthError && !this.fallback) {
        // Silently fall back to MapLibre
        try {
          this.map.remove()
        } catch {
          // ignore cleanup errors
        }
        this.fallback = new MapLibreAdapter(this.container, this.initOptions)
      }
    })
  }

  addSource(id: string, source: GeoJSONSourceSpecification): void {
    if (this.fallback) return this.fallback.addSource(id, source)
    try {
      this.map.addSource(id, source as mapboxgl.AnySourceData)
    } catch (err) {
      console.error(`[MapboxAdapter] addSource(${id}) failed:`, err)
    }
  }

  removeSource(id: string): void {
    if (this.fallback) return this.fallback.removeSource(id)
    try {
      this.map.removeSource(id)
    } catch (err) {
      console.error(`[MapboxAdapter] removeSource(${id}) failed:`, err)
    }
  }

  addLayer(layer: LayerSpecification): void {
    if (this.fallback) return this.fallback.addLayer(layer)
    try {
      this.map.addLayer(layer as mapboxgl.AnyLayer)
    } catch (err) {
      console.error(`[MapboxAdapter] addLayer(${layer.id}) failed:`, err)
    }
  }

  removeLayer(id: string): void {
    if (this.fallback) return this.fallback.removeLayer(id)
    try {
      this.map.removeLayer(id)
    } catch (err) {
      console.error(`[MapboxAdapter] removeLayer(${id}) failed:`, err)
    }
  }

  setFeatureState(feature: FeatureIdentifier, state: Record<string, unknown>): void {
    if (this.fallback) return this.fallback.setFeatureState(feature, state)
    try {
      this.map.setFeatureState(feature as mapboxgl.FeatureIdentifier, state)
    } catch (err) {
      console.error(`[MapboxAdapter] setFeatureState failed:`, err)
    }
  }

  flyTo(options: FlyToOptions): void {
    if (this.fallback) return this.fallback.flyTo(options)
    try {
      this.map.flyTo(options as mapboxgl.FlyToOptions)
    } catch (err) {
      console.error(`[MapboxAdapter] flyTo failed:`, err)
    }
  }

  on(event: 'click', layerId: string, handler: (e: MapMouseEvent) => void): void
  on(event: 'contextmenu', layerId: string, handler: (e: MapMouseEvent) => void): void
  on(event: 'click' | 'contextmenu', layerId: string, handler: (e: MapMouseEvent) => void): void {
    if (this.fallback) return this.fallback.on(event, layerId, handler)
    try {
      this.map.on(event, layerId, handler as (e: mapboxgl.MapMouseEvent) => void)
    } catch (err) {
      console.error(`[MapboxAdapter] on(${event}, ${layerId}) failed:`, err)
    }
  }

  off(event: string, layerId: string, handler: (e: MapMouseEvent) => void): void {
    if (this.fallback) return this.fallback.off(event, layerId, handler)
    try {
      this.map.off(event, layerId, handler as (e: mapboxgl.MapMouseEvent) => void)
    } catch (err) {
      console.error(`[MapboxAdapter] off(${event}, ${layerId}) failed:`, err)
    }
  }

  getCanvas(): HTMLCanvasElement {
    if (this.fallback) return this.fallback.getCanvas()
    try {
      return this.map.getCanvas()
    } catch (err) {
      console.error(`[MapboxAdapter] getCanvas failed:`, err)
      return document.createElement('canvas')
    }
  }

  resize(): void {
    if (this.fallback) return this.fallback.resize()
    try {
      this.map.resize()
    } catch (err) {
      console.error(`[MapboxAdapter] resize failed:`, err)
    }
  }

  setLayoutProperty(layerId: string, name: string, value: unknown): void {
    if (this.fallback) return this.fallback.setLayoutProperty(layerId, name, value)
    try {
      this.map.setLayoutProperty(layerId, name, value)
    } catch (err) {
      console.error(`[MapboxAdapter] setLayoutProperty(${layerId}, ${name}) failed:`, err)
    }
  }

  waitForLoad(): Promise<void> {
    if (this.fallback) return this.fallback.waitForLoad()
    return new Promise((resolve) => {
      if (this.map.isStyleLoaded()) {
        resolve()
      } else {
        this.map.once('load', () => resolve())
      }
    })
  }

  remove(): void {
    if (this.fallback) return this.fallback.remove()
    try {
      this.map.remove()
    } catch (err) {
      console.error(`[MapboxAdapter] remove failed:`, err)
    }
  }
}
