interface NominatimAddress {
  road?: string
  suburb?: string
  city_district?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  amenity?: string
  leisure?: string
  tourism?: string
  park?: string
  natural?: string
  [key: string]: string | undefined
}

interface NominatimResponse {
  display_name?: string
  address?: NominatimAddress
  error?: string
}

/**
 * Reverse-geocode coordinates to a human-readable Chinese location name
 * using Nominatim (OSM). Returns `null` on failure or rate-limit.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("lat", String(latitude))
    url.searchParams.set("lon", String(longitude))
    url.searchParams.set("format", "json")
    url.searchParams.set("accept-language", "zh")
    url.searchParams.set("zoom", "16")
    url.searchParams.set("addressdetails", "1")

    const response = await fetch(url, {
      headers: { "User-Agent": "SteamExplore/1.0 (nature-observation)" },
      signal,
    })
    if (!response.ok) return null

    const data: NominatimResponse = await response.json()
    if (data.error || !data.address) return null

    return buildReadableName(data.address) || data.display_name?.split(",")[0] || null
  } catch {
    return null
  }
}

function buildReadableName(addr: NominatimAddress): string | null {
  const poi = addr.amenity || addr.leisure || addr.tourism || addr.park || addr.natural
  const area = addr.suburb || addr.city_district || addr.town || addr.village || addr.county
  const city = addr.city || addr.state

  if (poi && area) return `${area}${poi}`
  if (poi && city) return `${city}${poi}`
  if (area && addr.road) return `${area}${addr.road}`
  if (poi) return poi
  if (area) return area
  return null
}
