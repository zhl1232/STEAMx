import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getObservations } from '@/lib/api/nature-observation-data'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const relativeOrAbsoluteUrlSchema = z.union([
  z.string().url(),
  z.string().min(1).startsWith('/'),
])

const ObservationSpeciesInputSchema = z.object({
  species_id: z.number().int().positive(),
  count: z.number().int().positive().nullable().optional(),
  behavior_tags: z.array(z.string().min(1).max(50)).max(10).default([]),
  notes: z.string().max(1000).nullable().optional(),
})

const CreateObservationSchema = z.object({
  project_id: z.number().int().positive().nullable().optional(),
  challenge_id: z.number().int().positive().nullable().optional(),
  observed_at: z.string().min(1),
  location_name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_precision: z.enum(['exact', 'approximate', 'hidden']).default('approximate'),
  habitat: z.string().max(100).nullable().optional(),
  weather: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  media_urls: z.array(relativeOrAbsoluteUrlSchema).min(1).max(5),
  is_public: z.boolean().default(true),
  species_entries: z.array(ObservationSpeciesInputSchema).min(1).max(10),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10) || 12))

    const { observations, total, hasMore } = await getObservations({ page, pageSize })
    return NextResponse.json({ observations, total, hasMore })
  } catch (error) {
    logger.error('Error in GET /api/observations', { error })
    return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json()
    const parsed = CreateObservationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const payload = parsed.data

    const { data: observation, error: observationError } = await supabase
      .from('observation_events')
      .insert({
        user_id: user.id,
        project_id: payload.project_id ?? null,
        challenge_id: payload.challenge_id ?? null,
        observed_at: payload.observed_at,
        location_name: payload.location_name,
        latitude: payload.latitude,
        longitude: payload.longitude,
        location_precision: payload.location_precision,
        habitat: payload.habitat ?? null,
        weather: payload.weather ?? null,
        notes: payload.notes ?? null,
        media_urls: payload.media_urls,
        is_public: payload.is_public,
        status: 'approved',
      })
      .select('*')
      .single()

    if (observationError || !observation) {
      throw observationError || new Error('Failed to create observation')
    }

    if (payload.species_entries.length > 0) {
      const { error: speciesError } = await supabase
        .from('observation_event_species')
        .insert(
          payload.species_entries.map((entry) => ({
            observation_event_id: observation.id,
            species_id: entry.species_id,
            count: entry.count ?? null,
            behavior_tags: entry.behavior_tags,
            notes: entry.notes ?? null,
            confidence: null,
          })),
        )

      if (speciesError) {
        await supabase
          .from('observation_events')
          .delete()
          .eq('id', observation.id)
          .eq('user_id', user.id)

        throw speciesError
      }
    }

    return NextResponse.json({ observation }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
