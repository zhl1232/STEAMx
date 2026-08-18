import type { ObservationLifecycleStage, ObservationSex } from '@/lib/observations/traits'

export const OBSERVATION_PHOTO_LOCATION_SOURCES = [
  'photo_exif',
  'place_search',
  'map_pin',
  'device_location',
] as const

export type ObservationPhotoLocationSource = (typeof OBSERVATION_PHOTO_LOCATION_SOURCES)[number]
export type ObservationPhotoTimeSource = 'photo_exif' | 'manual'

export interface ObservationPhotoDraft {
  speciesId: string
  sex: '' | ObservationSex
  lifecycleStage: '' | ObservationLifecycleStage
  observedAt: string
  observedAtSource: ObservationPhotoTimeSource
  latitude: string
  longitude: string
  locationName: string
  locationSource: ObservationPhotoLocationSource
  locationWarning: string
}

export function nowLocalDateTimeInput(date = new Date()): string {
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

export function createEmptyPhotoDraft(now = nowLocalDateTimeInput()): ObservationPhotoDraft {
  return {
    speciesId: '',
    sex: '',
    lifecycleStage: '',
    observedAt: now,
    observedAtSource: 'manual',
    latitude: '',
    longitude: '',
    locationName: '',
    locationSource: 'map_pin',
    locationWarning: '',
  }
}

export function isPhotoLocated(draft: Pick<ObservationPhotoDraft, 'locationName' | 'latitude' | 'longitude'>): boolean {
  return Boolean(draft.locationName.trim() && draft.latitude.trim() && draft.longitude.trim())
}

export function isPhotoTimeReady(draft: Pick<ObservationPhotoDraft, 'observedAt'>): boolean {
  return Boolean(draft.observedAt) && !Number.isNaN(new Date(draft.observedAt).getTime())
}

export function isPhotoPublishReady(draft: ObservationPhotoDraft): boolean {
  return isPhotoLocated(draft) && isPhotoTimeReady(draft)
}

export function copyLocationToDraft(
  target: ObservationPhotoDraft,
  source: ObservationPhotoDraft,
): ObservationPhotoDraft {
  return {
    ...target,
    latitude: source.latitude,
    longitude: source.longitude,
    locationName: source.locationName,
    locationSource: source.locationSource,
    locationWarning: '',
  }
}

export function setManualLocationName(
  draft: ObservationPhotoDraft,
  locationName: string,
): ObservationPhotoDraft {
  return {
    ...draft,
    locationName,
    latitude: '',
    longitude: '',
    locationSource: 'map_pin',
    locationWarning: '',
  }
}

export function syncPhotoDrafts(
  imageUrls: string[],
  current: Record<string, ObservationPhotoDraft>,
  now = nowLocalDateTimeInput(),
): Record<string, ObservationPhotoDraft> {
  const next: Record<string, ObservationPhotoDraft> = {}
  for (const url of imageUrls) {
    next[url] = current[url] ?? createEmptyPhotoDraft(now)
  }
  return next
}
