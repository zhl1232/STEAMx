import { describe, expect, it, vi } from 'vitest'

import {
  PHOTO_METADATA_COORDINATE_CONVERSION_WARNING,
  PHOTO_METADATA_NO_GPS_WARNING,
  PHOTO_METADATA_REVERSE_GEOCODE_WARNING,
  resolveObservationPhotoMetadataAutofill,
} from './photo-metadata-autofill'

describe('resolveObservationPhotoMetadataAutofill', () => {
  it('uses that photo EXIF date and GPS to produce location autofill fields', async () => {
    const convertGpsToMap = vi.fn().mockResolvedValue({ latitude: 31.231, longitude: 121.474 })
    const reverseGeocode = vi.fn().mockResolvedValue('人民公园')

    const result = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: '2026-07-22T09:30', latitude: 31.2304, longitude: 121.4737 },
      convertGpsToMap,
      reverseGeocode,
    })

    expect(result.observedAt).toBe('2026-07-22T09:30')
    expect(result.observedAtSource).toBe('photo_exif')
    expect(result.latitude).toBe('31.231000')
    expect(result.longitude).toBe('121.474000')
    expect(result.locationName).toBe('人民公园')
    expect(result.locationSource).toBe('photo_exif')
    expect(result.warning).toBeUndefined()
    expect(convertGpsToMap).toHaveBeenCalledWith(31.2304, 121.4737)
    expect(reverseGeocode).toHaveBeenCalledWith(31.231, 121.474)
  })

  it('warns when the photo does not contain GPS metadata', async () => {
    const convertGpsToMap = vi.fn()
    const reverseGeocode = vi.fn()

    const result = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: '2026-07-22T09:30', latitude: null, longitude: null },
      convertGpsToMap,
      reverseGeocode,
    })

    expect(result.warning).toBe(PHOTO_METADATA_NO_GPS_WARNING)
    expect(result.observedAt).toBe('2026-07-22T09:30')
    expect(result.latitude).toBeUndefined()
    expect(convertGpsToMap).not.toHaveBeenCalled()
    expect(reverseGeocode).not.toHaveBeenCalled()
  })

  it('warns when GPS coordinates cannot be converted for the map provider', async () => {
    const convertGpsToMap = vi.fn().mockResolvedValue(null)
    const reverseGeocode = vi.fn()

    const result = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: null, latitude: 31.2304, longitude: 121.4737 },
      convertGpsToMap,
      reverseGeocode,
    })

    expect(result.warning).toBe(PHOTO_METADATA_COORDINATE_CONVERSION_WARNING)
    expect(result.latitude).toBeUndefined()
    expect(result.longitude).toBeUndefined()
    expect(reverseGeocode).not.toHaveBeenCalled()
  })

  it('keeps converted coordinates when reverse geocoding cannot find a place name', async () => {
    const convertGpsToMap = vi.fn().mockResolvedValue({ latitude: 31.231, longitude: 121.474 })
    const reverseGeocode = vi.fn().mockResolvedValue(null)

    const result = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: null, latitude: 31.2304, longitude: 121.4737 },
      convertGpsToMap,
      reverseGeocode,
    })

    expect(result.latitude).toBe('31.231000')
    expect(result.longitude).toBe('121.474000')
    expect(result.locationName).toBeUndefined()
    expect(result.warning).toBe(PHOTO_METADATA_REVERSE_GEOCODE_WARNING)
  })

  it('does not let a later photo GPS replace an earlier photo location', async () => {
    const convertGpsToMap = vi.fn()
      .mockResolvedValueOnce({ latitude: 31.231, longitude: 121.474 })
      .mockResolvedValueOnce({ latitude: 31.241, longitude: 121.49 })
    const reverseGeocode = vi.fn()
      .mockResolvedValueOnce('人民公园')
      .mockResolvedValueOnce('世纪公园')

    const first = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: null, latitude: 31.2304, longitude: 121.4737 },
      convertGpsToMap,
      reverseGeocode,
    })
    const second = await resolveObservationPhotoMetadataAutofill({
      metadata: { observedAt: null, latitude: 31.2409, longitude: 121.49 },
      convertGpsToMap,
      reverseGeocode,
    })

    expect(first.latitude).toBe('31.231000')
    expect(first.locationName).toBe('人民公园')
    expect(second.latitude).toBe('31.241000')
    expect(second.locationName).toBe('世纪公园')
    expect(convertGpsToMap).toHaveBeenNthCalledWith(1, 31.2304, 121.4737)
    expect(convertGpsToMap).toHaveBeenNthCalledWith(2, 31.2409, 121.49)
  })
})
