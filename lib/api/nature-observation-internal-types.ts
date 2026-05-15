/**
 * Supabase 查询行形状（与 nature 观察域读模型配套），供多文件共享，避免循环依赖。
 */

export type SpeciesRow = {
  id: number
  slug: string
  common_name: string
  scientific_name: string | null
  aliases: string[]
  taxon_group: string | null
  nature_topic: string | null
  identification_notes: string | null
  habitat_notes: string | null
  seasonality_notes: string | null
  cover_image_url: string | null
  audio_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ObservationEventRow = {
  id: number
  user_id: string
  observed_at: string
  location_name: string
  latitude: number | null
  longitude: number | null
  location_precision: string | null
  habitat: string | null
  weather: string | null
  notes: string | null
  media_urls: string[]
  is_public: boolean
  status: string
  created_at: string
  updated_at: string
}

export type ObservationEventSpeciesRow = {
  id: number
  observation_event_id: number
  species_id: number
  count: number | null
  behavior_tags: string[]
  confidence: number | null
  notes: string | null
  created_at: string
  updated_at: string
}
