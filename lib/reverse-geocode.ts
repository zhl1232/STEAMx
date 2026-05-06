interface ReverseGeocodeResponse {
  name?: string | null
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
