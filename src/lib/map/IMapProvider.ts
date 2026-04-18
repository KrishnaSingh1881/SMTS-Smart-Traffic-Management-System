/**
 * Map provider abstraction — compatible with both MapLibre GL JS and Mapbox GL JS.
 * Uses plain TypeScript types to avoid importing from either library directly.
 */

/** Initialisation options passed to the map provider factory. */
export type MapInitOptions = {
  center: [number, number]
  zoom: number
  style?: string
}

/** Minimal GeoJSON source specification (subset of maplibre/mapbox SourceSpecification). */
export type GeoJSONSourceSpecification = {
  type: 'geojson'
  data: object | string
  [key: string]: unknown
}

/** Minimal layer specification (subset of maplibre/mapbox LayerSpecification). */
export type LayerSpecification = {
  id: string
  type: string
  source?: string
  [key: string]: unknown
}

/** Feature identifier used by setFeatureState. */
export type FeatureIdentifier = {
  id: string | number
  source: string
  sourceLayer?: string
}

/** Minimal fly-to options. */
export type FlyToOptions = {
  center?: [number, number]
  zoom?: number
  speed?: number
  curve?: number
  [key: string]: unknown
}

/** Minimal map mouse event (compatible with both libraries). */
export type MapMouseEvent = {
  lngLat: { lng: number; lat: number }
  point: { x: number; y: number }
  features?: Array<{ id?: string | number; properties: Record<string, unknown> }>
  originalEvent: MouseEvent
  [key: string]: unknown
}

/**
 * Abstraction over a WebGL map instance (MapLibre GL JS or Mapbox GL JS).
 * All methods mirror the public API shared by both libraries.
 */
export interface IMapProvider {
  /** Add a GeoJSON data source. */
  addSource(id: string, source: GeoJSONSourceSpecification): void

  /** Remove a previously added source. */
  removeSource(id: string): void

  /** Add a style layer. */
  addLayer(layer: LayerSpecification): void

  /** Remove a style layer by id. */
  removeLayer(id: string): void

  /** Set feature-level state for hover/selection effects. */
  setFeatureState(feature: FeatureIdentifier, state: Record<string, unknown>): void

  /** Animate the camera to a new position. */
  flyTo(options: FlyToOptions): void

  /** Register a click handler scoped to a layer. */
  on(event: 'click', layerId: string, handler: (e: MapMouseEvent) => void): void

  /** Register a contextmenu handler scoped to a layer. */
  on(event: 'contextmenu', layerId: string, handler: (e: MapMouseEvent) => void): void

  /** Deregister an event handler. */
  off(event: string, layerId: string, handler: (e: MapMouseEvent) => void): void

  /** Return the underlying HTML canvas element. */
  getCanvas(): HTMLCanvasElement

  /** Trigger a resize to fit the container. */
  resize(): void

  /** Set a layout property on a layer (e.g. visibility). */
  setLayoutProperty(layerId: string, name: string, value: unknown): void

  /** Check if a specific source exists in the current style. */
  hasSource(id: string): boolean

  /** Check if the map style is currently loaded and ready for interaction. */
  isReady(): boolean

  /** Wait for the map style to finish loading. Returns a promise that resolves when ready. */
  waitForLoad(): Promise<void>

  /** Destroy the map instance and release resources. */
  remove(): void
}
