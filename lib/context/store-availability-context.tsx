'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

const StoreAvailabilityContext = createContext(false)

export function StoreAvailabilityProvider({ children }: { children: ReactNode }) {
  const { data, isError } = useQuery({
    queryKey: ['store-availability'],
    queryFn: async () => {
      const response = await fetch('/api/store/availability', { cache: 'no-store' })
      if (!response.ok) throw new Error('商城入口暂时不可用')
      const payload: unknown = await response.json()
      return typeof payload === 'object' && payload !== null
        && 'catalogVisible' in payload && payload.catalogVisible === true
    },
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  })

  // Runtime flags must also reach statically generated pages, such as the homepage.
  return <StoreAvailabilityContext.Provider value={!isError && data === true}>{children}</StoreAvailabilityContext.Provider>
}

export function useStoreCatalogVisible() {
  return useContext(StoreAvailabilityContext)
}

/** Catalog entry points are available only in local development during rollout. */
export function useStoreEntryVisible() {
  const catalogVisible = useStoreCatalogVisible()
  return process.env.NODE_ENV === 'development' && catalogVisible
}
