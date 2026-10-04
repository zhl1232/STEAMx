import type { ObservationPhotoMetadata } from '@/lib/observation-photo-metadata'
import type { ObservationPhotoLocationSource, ObservationPhotoTimeSource } from '@/lib/observations/photo-draft'

export const PHOTO_METADATA_NO_GPS_WARNING = '网页收到的照片文件中未读取到 GPS。若手机相册显示地点，可尝试从「文件」选择原图；系统照片选择器可能未保留定位信息。也可以在地图上确认实际观察地点。'
export const PHOTO_METADATA_UNREADABLE_WARNING = '照片拍摄信息读取失败，暂时无法判断文件是否包含 GPS。请尝试选择原始 JPG / PNG 文件，或手动确认观察时间和地点。'
export const PHOTO_METADATA_UNSUPPORTED_WARNING = '当前图片格式暂不支持读取拍摄信息。可选择原始 JPG / PNG 文件，或手动确认观察时间和地点。'
export const PHOTO_METADATA_COORDINATE_CONVERSION_WARNING = '照片包含 GPS，但地图服务暂时无法转换坐标，请搜索选择地点或在地图上选点。'
export const PHOTO_METADATA_REVERSE_GEOCODE_WARNING = '已读取照片 GPS，但暂时没有找到地点名称，请搜索选择地点或手动输入地点。'

interface MapCoordinates {
  latitude: number
  longitude: number
}

interface ResolveObservationPhotoMetadataAutofillOptions {
  metadata: ObservationPhotoMetadata
  convertGpsToMap: (latitude: number, longitude: number) => Promise<MapCoordinates | null>
  reverseGeocode: (latitude: number, longitude: number) => Promise<string | null>
}

export interface ObservationPhotoMetadataAutofillResult {
  observedAt?: string
  observedAtSource?: ObservationPhotoTimeSource
  latitude?: string
  longitude?: string
  locationName?: string
  locationSource?: ObservationPhotoLocationSource
  warning?: string
}

function hasPhotoCoordinates(
  item: ObservationPhotoMetadata,
): item is ObservationPhotoMetadata & { latitude: number; longitude: number } {
  return item.latitude != null && item.longitude != null
}

export async function resolveObservationPhotoMetadataAutofill({
  metadata,
  convertGpsToMap,
  reverseGeocode,
}: ResolveObservationPhotoMetadataAutofillOptions): Promise<ObservationPhotoMetadataAutofillResult> {
  const result: ObservationPhotoMetadataAutofillResult = {}

  if (metadata.observedAt) {
    result.observedAt = metadata.observedAt
    result.observedAtSource = 'photo_exif'
  }

  if (!hasPhotoCoordinates(metadata)) {
    result.warning = metadata.gpsReadStatus === 'unreadable'
      ? PHOTO_METADATA_UNREADABLE_WARNING
      : metadata.gpsReadStatus === 'unsupported_format'
        ? PHOTO_METADATA_UNSUPPORTED_WARNING
        : PHOTO_METADATA_NO_GPS_WARNING
    return result
  }

  const converted = await convertGpsToMap(metadata.latitude, metadata.longitude)
  if (!converted) {
    result.warning = PHOTO_METADATA_COORDINATE_CONVERSION_WARNING
    return result
  }

  const name = await reverseGeocode(converted.latitude, converted.longitude)
  result.latitude = converted.latitude.toFixed(6)
  result.longitude = converted.longitude.toFixed(6)
  result.locationSource = 'photo_exif'
  if (name) {
    result.locationName = name
  } else {
    result.warning = PHOTO_METADATA_REVERSE_GEOCODE_WARNING
  }

  return result
}
