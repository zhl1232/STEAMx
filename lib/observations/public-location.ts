interface PublicLocationRow {
  user_id: string
  location_name: string
  latitude: number | null
  longitude: number | null
  location_precision: string | null
}

export function applyHistoricalPublicLocationPrecision<T extends PublicLocationRow>(
  row: T,
  viewerId?: string | null,
): T {
  if (viewerId && row.user_id === viewerId) return row
  if (row.location_precision === 'hidden') {
    return { ...row, location_name: '位置已隐藏', latitude: null, longitude: null }
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
