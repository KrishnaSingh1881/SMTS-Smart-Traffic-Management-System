'use client'

import { createContext, useContext } from 'react'
import { IMapProvider } from '../lib/map/IMapProvider'

export const MapProviderContext = createContext<IMapProvider | null>(null)

export function useMapProvider(): IMapProvider | null {
  return useContext(MapProviderContext)
}
