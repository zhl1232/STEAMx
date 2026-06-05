import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  getObservationAnalysisErrorMessage,
  isObservationAnalysisPassed,
  parseStoredSpeciesCandidates,
  type ObservationMediaAnalysisRow,
} from '@/lib/ai/observation-media-analysis'
import { selectAiIdentification } from '@/lib/observations/identifications'
import { getObservations } from '@/lib/api/nature-observation-data'
import { isOwnedProjectImageUrl, validateContentSafeIfPresent } from '@/lib/api/validation'
import { buildObservationRewardSummary } from '@/lib/api/observation-gamification'
import { enqueueAutoInteractionsForTarget } from '@/lib/auto-interactions'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { observationSubmitTopicKeys } from '@/lib/observations/submit-topic'

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
  nature_topic: z.enum(observationSubmitTopicKeys),
  observed_at: z.string().min(1),
  observed_at_source: z.enum(['photo_exif', 'manual']).default('manual'),
  location_name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_source: z.enum(['photo_exif', 'place_search', 'map_pin', 'device_location']).default('map_pin'),
  coordinate_system: z.literal('gcj02').default('gcj02'),
  habitat: z.string().max(100).nullable().optional(),
  weather: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  media_urls: z.array(relativeOrAbsoluteUrlSchema).min(1).max(5),
  is_public: z.boolean().default(true),
  initial_species_id: z.number().int().positive().nullable().optional(),
  species_entries: z.array(ObservationSpeciesInputSchema).max(1).optional(),
  lifecycle_stage: z.enum(['egg', 'larva', 'pupa', 'juvenile', 'adult', 'unknown']).nullable().optional(),
  sex: z.enum(['male', 'female', 'unknown']).nullable().optional(),
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
    const uniqueMediaUrls = Array.from(new Set(payload.media_urls))

    validateContentSafeIfPresent(payload.location_name, '观察地点')
    validateContentSafeIfPresent(payload.habitat, '生境')
    validateContentSafeIfPresent(payload.weather, '天气')
    validateContentSafeIfPresent(payload.notes, '观察备注')
    for (const entry of payload.species_entries ?? []) {
      validateContentSafeIfPresent(entry.notes, '物种备注')
      for (const tag of entry.behavior_tags) {
        validateContentSafeIfPresent(tag, '行为标签')
      }
    }

    if (uniqueMediaUrls.some((url) => !isOwnedProjectImageUrl(url, user.id, 'observations'))) {
      return NextResponse.json({ error: '观察图片必须使用当前账号上传的文件' }, { status: 400 })
    }

    const { data: analysisRows, error: analysisError } = await supabase
      .from('observation_media_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('nature_topic', payload.nature_topic)
      .in('image_url', uniqueMediaUrls)

    if (analysisError) {
      throw analysisError
    }

    const analysisMap = new Map<string, ObservationMediaAnalysisRow>(
      ((analysisRows || []) as ObservationMediaAnalysisRow[]).map((row) => [row.image_url, row]),
    )

    for (const imageUrl of uniqueMediaUrls) {
      const analysis = analysisMap.get(imageUrl)
      if (!isObservationAnalysisPassed(analysis)) {
        return NextResponse.json(
          { error: getObservationAnalysisErrorMessage(analysis) },
          { status: 400 },
        )
      }
    }

    const selectedSpeciesId = payload.initial_species_id ?? payload.species_entries?.[0]?.species_id ?? null
    const typedAnalyses = uniqueMediaUrls
      .map((imageUrl) => analysisMap.get(imageUrl))
      .filter((row): row is ObservationMediaAnalysisRow => Boolean(row))
    const aiIdentification = selectAiIdentification(
      typedAnalyses.map((row) => ({
        status: row.status,
        speciesCandidates: parseStoredSpeciesCandidates(row.species_candidates).map((candidate) => ({
          speciesId: candidate.speciesId,
          confidence: candidate.confidence,
        })),
      })),
    )
    const aiSourceRow = aiIdentification
      ? typedAnalyses.find((row) => parseStoredSpeciesCandidates(row.species_candidates)[0]?.speciesId === aiIdentification.speciesId)
      : null

    const { data: observation, error: observationError } = await supabase
      .from('observation_events')
      .insert({
        user_id: user.id,
        nature_topic: payload.nature_topic,
        observed_at: payload.observed_at,
        observed_at_source: payload.observed_at_source,
        location_name: payload.location_name,
        latitude: payload.latitude,
        longitude: payload.longitude,
        location_precision: 'exact',
        location_source: payload.location_source,
        coordinate_system: payload.coordinate_system,
        habitat: payload.habitat ?? null,
        weather: payload.weather ?? null,
        notes: payload.notes ?? null,
        media_urls: payload.media_urls,
        is_public: payload.is_public,
        status: 'approved',
        lifecycle_stage: payload.lifecycle_stage ?? null,
        sex: payload.sex ?? null,
      })
      .select('*')
      .single()

    if (observationError || !observation) {
      throw observationError || new Error('Failed to create observation')
    }

    try {
      if (selectedSpeciesId) {
        const { error } = await callRpc(supabase, 'upsert_observation_identification', {
          p_observation_id: observation.id,
          p_species_id: selectedSpeciesId,
          p_source: 'human',
        })
        if (error) throw error
      }

      if (aiIdentification) {
        if (!supabaseAdmin) throw new Error('AI identification service is unavailable')
        const { error } = await callRpc(supabaseAdmin, 'record_observation_ai_identification', {
          p_observation_id: observation.id,
          p_species_id: aiIdentification.speciesId,
          p_confidence: aiIdentification.confidence,
          p_model_name: aiSourceRow?.model_name || 'ai-vision',
          p_media_analysis_id: aiSourceRow?.id ?? null,
        })
        if (error) throw error
      }
    } catch (identificationError) {
      await supabase
        .from('observation_events')
        .delete()
        .eq('id', observation.id)
        .eq('user_id', user.id)
      throw identificationError
    }

    const rewardSummary = await buildObservationRewardSummary(user.id, observation.id)

    try {
      await enqueueAutoInteractionsForTarget('observation', Number(observation.id))
    } catch (autoInteractionError) {
      logger.error(autoInteractionError, {
        context: 'Observation auto interaction enqueue failed',
        observationId: observation.id,
      })
    }

    return NextResponse.json({ observation, rewardSummary }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
