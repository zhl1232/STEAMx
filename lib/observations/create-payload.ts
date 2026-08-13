import { z } from 'zod'

import { observationLifecycleStageValues, observationSexValues } from '@/lib/observations/traits'

const relativeOrAbsoluteUrlSchema = z.union([
  z.string().url(),
  z.string().min(1).startsWith('/'),
])

export const ObservationCreateItemSchema = z.object({
  media_url: relativeOrAbsoluteUrlSchema,
  observed_at: z.string().min(1),
  observed_at_source: z.enum(['photo_exif', 'manual']).default('manual'),
  location_name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_source: z.enum(['photo_exif', 'place_search', 'map_pin', 'device_location']).default('map_pin'),
  coordinate_system: z.literal('gcj02').default('gcj02'),
  initial_species_id: z.number().int().positive().nullable().optional(),
  lifecycle_stage: z.enum(observationLifecycleStageValues).nullable().optional(),
  sex: z.enum(observationSexValues).nullable().optional(),
})

export const CreateObservationBatchSchema = z.object({
  is_public: z.boolean().default(true),
  items: z.array(ObservationCreateItemSchema).min(1).max(5),
})

export type ObservationCreateItem = z.infer<typeof ObservationCreateItemSchema>
export type CreateObservationBatch = z.infer<typeof CreateObservationBatchSchema>

export function uniqueMediaUrlsFromItems(items: ObservationCreateItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.media_url)))
}

export function hasDuplicateMediaUrls(items: ObservationCreateItem[]): boolean {
  return uniqueMediaUrlsFromItems(items).length !== items.length
}
