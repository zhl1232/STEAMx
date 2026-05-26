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

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  try {
    const url = new URL('/api/geo/search', window.location.origin)
    url.searchParams.set('q', query)
    const response = await fetch(url, { signal })
    if (!response.ok) return []
    const data = await response.json() as { places?: PlaceSearchResult[] }
    return data.places || []
  } catch {
    return []
  }
}
