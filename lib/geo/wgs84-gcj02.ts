const PI = Math.PI
const AXIS = 6378245.0
const ECCENTRICITY_SQUARED = 0.006693421622965943

function isOutsideChina(latitude: number, longitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function transformLatitude(x: number, y: number) {
  let result = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  result += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  result += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  result += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return result
}

function transformLongitude(x: number, y: number) {
  let result = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  result += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  result += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  result += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return result
}

export interface GeoCoordinate {
  latitude: number
  longitude: number
}

/**
 * Convert EXIF GPS (WGS-84) to the GCJ-02 coordinates used by the domestic map.
 * This keeps photo GPS useful even when the optional AMap web-service key is
 * unavailable. Coordinates outside mainland China are returned unchanged.
 */
export function wgs84ToGcj02(latitude: number, longitude: number): GeoCoordinate {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || isOutsideChina(latitude, longitude)) {
    return { latitude, longitude }
  }

  const dLat = transformLatitude(longitude - 105.0, latitude - 35.0)
  const dLon = transformLongitude(longitude - 105.0, latitude - 35.0)
  const radLatitude = latitude / 180.0 * PI
  const magic = 1 - ECCENTRICITY_SQUARED * Math.sin(radLatitude) ** 2
  const sqrtMagic = Math.sqrt(magic)

  return {
    latitude: latitude + (dLat * 180.0) / ((AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * PI),
    longitude: longitude + (dLon * 180.0) / (AXIS / sqrtMagic * Math.cos(radLatitude) * PI),
  }
}
