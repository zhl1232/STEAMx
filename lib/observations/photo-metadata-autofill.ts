import type { ObservationPhotoMetadata } from '@/lib/observation-photo-metadata'

export const PHOTO_METADATA_NO_GPS_WARNING = '没有读取到照片 GPS，请搜索选择地点或在地图上选点。'
export const PHOTO_METADATA_COORDINATE_CONVERSION_WARNING = '照片包含 GPS，但地图服务暂时无法转换坐标，请搜索选择地点或在地图上选点。'
export const PHOTO_METADATA_REVERSE_GEOCODE_WARNING = '已读取照片 GPS，但暂时没有找到地点名称，请搜索选择地点或手动输入地点。'

interface MapCoordinates {
  latitude: number
  longitude: number
}

interface ResolveObservationPhotoMetadataAutofillOptions {
  previousMetadata: ObservationPhotoMetadata[]
  incomingMetadata: ObservationPhotoMetadata[]
  currentObservedAt: string
  currentLatitude: string
  currentLongitude: string
  convertGpsToMap: (latitude: number, longitude: number) => Promise<MapCoordinates | null>
  reverseGeocode: (latitude: number, longitude: number) => Promise<string | null>
}

export interface ObservationPhotoMetadataAutofillResult {
  allMetadata: ObservationPhotoMetadata[]
  observedAt?: string
  observedAtSource?: 'photo_exif'
  latitude?: string
  longitude?: string
  locationName?: string
  locationSource?: 'photo_exif'
  shouldClearPlaceResults?: boolean
  warning?: string
}

function hasCoordinateField(value: string) {
  return value.trim().length > 0
}

function hasPhotoCoordinates(
  item: ObservationPhotoMetadata,
): item is ObservationPhotoMetadata & { latitude: number; longitude: number } {
  return item.latitude != null && item.longitude != null
}

export async function resolveObservationPhotoMetadataAutofill({
  previousMetadata,
  incomingMetadata,
  currentObservedAt,
  currentLatitude,
  currentLongitude,
  convertGpsToMap,
  reverseGeocode,
}: ResolveObservationPhotoMetadataAutofillOptions): Promise<ObservationPhotoMetadataAutofillResult> {
  const allMetadata = [...previousMetadata, ...incomingMetadata]
  const result: ObservationPhotoMetadataAutofillResult = { allMetadata }
  const firstObservedAt = allMetadata.find((item) => item.observedAt)?.observedAt
  const firstPositionMetadata = allMetadata.find(hasPhotoCoordinates)

  if (allMetadata.length === 0) {
    return result
  }

  if (firstObservedAt && !currentObservedAt) {
    result.observedAt = firstObservedAt
    result.observedAtSource = 'photo_exif'
  }

  const alreadyHasCoordinates = hasCoordinateField(currentLatitude) || hasCoordinateField(currentLongitude)
  if (!firstPositionMetadata) {
    return {
      ...result,
      warning: alreadyHasCoordinates ? result.warning : result.warning ?? PHOTO_METADATA_NO_GPS_WARNING,
    }
  }

  if (alreadyHasCoordinates) {
    return result
  }

  const converted = await convertGpsToMap(firstPositionMetadata.latitude, firstPositionMetadata.longitude)
  if (!converted) {
    return {
      ...result,
      warning: PHOTO_METADATA_COORDINATE_CONVERSION_WARNING,
    }
  }

  const name = await reverseGeocode(converted.latitude, converted.longitude)
  return {
    ...result,
    latitude: converted.latitude.toFixed(6),
    longitude: converted.longitude.toFixed(6),
    locationName: name || undefined,
    locationSource: 'photo_exif',
    shouldClearPlaceResults: true,
    warning: name ? result.warning : PHOTO_METADATA_REVERSE_GEOCODE_WARNING,
  }
}
