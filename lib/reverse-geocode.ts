interface ReverseGeocodeResponse {
  name?: string | null
}

export interface PlaceSearchResult {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  coordinateSystem: 'gcj02'
}

export interface PlaceSearchResponse {
  places: PlaceSearchResult[]
  configured: boolean
}

/**
 * Reverse-geocode coordinates to a human-readable location name.
 * The browser calls our server route so map service keys stay private.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = new URL("/api/geo/reverse", window.location.origin)
    url.searchParams.set("lat", String(latitude))
    url.searchParams.set("lng", String(longitude))

    const response = await fetch(url, { signal })
    if (!response.ok) return null

    const data: ReverseGeocodeResponse = await response.json()
    return data.name?.trim() || null
  } catch {
    return null
  }
}

export async function convertGpsToAmap(latitude: number, longitude: number): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = new URL('/api/geo/convert', window.location.origin)
    url.searchParams.set('lat', String(latitude))
    url.searchParams.set('lng', String(longitude))
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json() as { latitude?: number; longitude?: number }
    return typeof data.latitude === 'number' && typeof data.longitude === 'number'
      ? { latitude: data.latitude, longitude: data.longitude }
      : null
  } catch {
    return null
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSearchResponse> {
  return searchPlacesNear(query, undefined, signal)
}

export async function searchPlacesNear(
  query: string,
  center?: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<PlaceSearchResponse> {
  try {
    const url = new URL('/api/geo/search', window.location.origin)
    url.searchParams.set('q', query)
    if (center && Number.isFinite(center.latitude) && Number.isFinite(center.longitude)) {
      url.searchParams.set('lat', String(center.latitude))
      url.searchParams.set('lng', String(center.longitude))
    }
    const response = await fetch(url, { signal })
    if (!response.ok) return { places: [], configured: true }
    const data = await response.json() as { places?: PlaceSearchResult[]; configured?: boolean }
    return { places: data.places || [], configured: data.configured !== false }
  } catch {
    return { places: [], configured: true }
  }
}
