import { MapLibreAdapter } from './MapLibreAdapter'
import { MapboxAdapter } from './MapboxAdapter'
import type { IMapProvider, MapInitOptions } from './IMapProvider'

/**
 * Factory that selects the appropriate map provider at call time.
 * Returns a MapboxAdapter when NEXT_PUBLIC_MAPBOX_TOKEN is set,
 * otherwise falls back to MapLibreAdapter.
 *
 * This is the ONLY file that imports either adapter.
 */
export function createMapProvider(
  container: HTMLElement,
  options: MapInitOptions,
): IMapProvider {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (token) {
    return new MapboxAdapter(container, { ...options, token })
  }

  return new MapLibreAdapter(container, options)
}
