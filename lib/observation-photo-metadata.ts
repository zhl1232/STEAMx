import { parse } from 'exifr'

export interface ObservationPhotoMetadata {
  observedAt: string | null
  latitude: number | null
  longitude: number | null
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
    const result = await parse(file, { gps: true, tiff: true, exif: true }) as {
      DateTimeOriginal?: Date
      CreateDate?: Date
      latitude?: number
      longitude?: number
    } | undefined
    const sourceDate = result?.DateTimeOriginal ?? result?.CreateDate

    return {
      observedAt: sourceDate instanceof Date && !Number.isNaN(sourceDate.getTime())
        ? toLocalDateTimeInput(sourceDate)
        : null,
      latitude: typeof result?.latitude === 'number' ? result.latitude : null,
      longitude: typeof result?.longitude === 'number' ? result.longitude : null,
    }
  } catch {
    return { observedAt: null, latitude: null, longitude: null }
  }
}
