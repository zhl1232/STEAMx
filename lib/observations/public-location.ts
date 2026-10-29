import { publicAreaLabel } from '@/lib/geo/place-privacy'

interface PublicLocationRow {
  user_id: string
  location_name: string
  latitude: number | null
  longitude: number | null
  location_precision: string | null
  public_township?: string | null
  public_district?: string | null
  public_city?: string | null
}

export function applyHistoricalPublicLocationPrecision<T extends PublicLocationRow>(
  row: T,
  viewerId?: string | null,
): T {
  if (viewerId && row.user_id === viewerId) return row
  if (row.location_precision === 'hidden') {
    return { ...row, location_name: '位置已隐藏', latitude: null, longitude: null }
  }
  // Only public-view fields may supply a missing public place name.
  const name = row.location_name?.trim()
  if (!name || name === '大概区域') {
    const area = publicAreaLabel({
      township: row.public_township,
      district: row.public_district,
      city: row.public_city,
    })
    row = { ...row, location_name: area === '大概区域' ? '' : area }
  }
  if (row.location_precision === 'approximate') {
    return {
      ...row,
      latitude: row.latitude == null ? null : Number(row.latitude.toFixed(3)),
      longitude: row.longitude == null ? null : Number(row.longitude.toFixed(3)),
    }
  }
  return row
}
