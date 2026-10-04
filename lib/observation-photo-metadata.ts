import { parse } from 'exifr'

export interface ObservationPhotoMetadata {
  observedAt: string | null
  latitude: number | null
  longitude: number | null
  gpsReadStatus?: 'present' | 'missing' | 'unreadable' | 'unsupported_format'
}

const PARSE_OPTIONS = { gps: true, tiff: true, exif: true, silentErrors: false }

// exifr supports TIFF/EXIF but does not open WebP containers. Extract that
// container's EXIF chunk before parsing, including the optional Exif prefix.
function webpExif(bytes: Uint8Array): Uint8Array | null | undefined {
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length))
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WEBP') return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = view.getUint32(4, true) + 8
  if (end > bytes.length || end < 12) throw new Error('Invalid WebP container')
  for (let offset = 12; offset + 8 <= end;) {
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + size > end) throw new Error('Invalid WebP chunk')
    if (text(offset, 4) === 'EXIF') {
      const prefix = text(start, 6) === 'Exif\0\0' ? 6 : 0
      return bytes.subarray(start + prefix, start + size)
    }
    offset = start + size + (size % 2)
  }
  return null
}

async function parsePhoto(file: File) {
  try {
    return await parse(file, PARSE_OPTIONS)
  } catch {
    // Some file providers do not support the sliced Blob/FileReader path.
    // Retry the same original bytes with the standard File API.
    const bytes = new Uint8Array(await file.arrayBuffer())
    const exif = webpExif(bytes)
    if (exif === null) return undefined
    return parse(exif ?? bytes, PARSE_OPTIONS)
  }
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

export async function readObservationPhotoMetadata(file: File): Promise<ObservationPhotoMetadata> {
  try {
    const result = await parsePhoto(file) as {
      DateTimeOriginal?: Date
      CreateDate?: Date
      latitude?: number
      longitude?: number
    } | undefined
    const sourceDate = result?.DateTimeOriginal ?? result?.CreateDate
    const latitude = typeof result?.latitude === 'number' && Number.isFinite(result.latitude) && Math.abs(result.latitude) <= 90 ? result.latitude : null
    const longitude = typeof result?.longitude === 'number' && Number.isFinite(result.longitude) && Math.abs(result.longitude) <= 180 ? result.longitude : null

    return {
      observedAt: sourceDate instanceof Date && !Number.isNaN(sourceDate.getTime())
        ? toLocalDateTimeInput(sourceDate)
        : null,
      latitude,
      longitude,
      gpsReadStatus: latitude != null && longitude != null ? 'present' : 'missing',
    }
  } catch {
    return { observedAt: null, latitude: null, longitude: null, gpsReadStatus: file.type === 'image/gif' ? 'unsupported_format' : 'unreadable' }
  }
}
