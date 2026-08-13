import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getObservationAnalysisErrorMessage,
  isObservationAnalysisPassed,
  parseStoredSpeciesCandidates,
  type ObservationMediaAnalysisRow,
} from '@/lib/ai/observation-media-analysis'
import { selectAiIdentification } from '@/lib/observations/identifications'
import {
  CreateObservationBatchSchema,
  hasDuplicateMediaUrls,
  uniqueMediaUrlsFromItems,
  type ObservationCreateItem,
} from '@/lib/observations/create-payload'
import { rollbackCreatedObservations } from '@/lib/observations/create-rollback'
import { getObservations } from '@/lib/api/nature-observation-data'
import { isOwnedProjectImageUrl, validateContentSafeIfPresent } from '@/lib/api/validation'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { createModerationCase, moderateUserContent } from '@/lib/safety/server'
import type { Database } from '@/lib/supabase/types'

type DbClient = SupabaseClient<Database>
type ObservationEventRow = Database['public']['Tables']['observation_events']['Row']

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

function analysisVoteInput(row: ObservationMediaAnalysisRow) {
  return {
    status: row.status,
    speciesCandidates: parseStoredSpeciesCandidates(row.species_candidates).map((candidate) => ({
      speciesId: candidate.speciesId,
      confidence: candidate.confidence,
    })),
  }
}

async function attachIdentifications(options: {
  supabase: DbClient
  observationId: number
  item: ObservationCreateItem
  analysis: ObservationMediaAnalysisRow | undefined
}) {
  const { supabase, observationId, item, analysis } = options
  if (item.initial_species_id) {
    const { error } = await callRpc(supabase, 'upsert_observation_identification', {
      p_observation_id: observationId,
      p_species_id: item.initial_species_id,
      p_source: 'human',
      p_lifecycle_stage: item.lifecycle_stage ?? null,
      p_sex: item.sex ?? null,
    })
    if (error) throw error
  }

  if (!analysis) return

  const aiIdentification = selectAiIdentification([analysisVoteInput(analysis)])
  if (!aiIdentification) return
  if (!supabaseAdmin) throw new Error('AI identification service is unavailable')

  const { error } = await callRpc(supabaseAdmin, 'record_observation_ai_identification', {
    p_observation_id: observationId,
    p_species_id: aiIdentification.speciesId,
    p_confidence: aiIdentification.confidence,
    p_model_name: analysis.model_name || 'ai-vision',
    p_media_analysis_id: analysis.id ?? null,
  })
  if (error) throw error
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'submit')
    const body = await request.json()
    const parsed = CreateObservationBatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const payload = parsed.data
    if (hasDuplicateMediaUrls(payload.items)) {
      return NextResponse.json({ error: '观察图片不能重复提交' }, { status: 400 })
    }

    const uniqueMediaUrls = uniqueMediaUrlsFromItems(payload.items)
    for (const item of payload.items) {
      validateContentSafeIfPresent(item.location_name, '观察地点')
    }

    if (uniqueMediaUrls.some((url) => !isOwnedProjectImageUrl(url, user.id, 'observations'))) {
      return NextResponse.json({ error: '观察图片必须使用当前账号上传的文件' }, { status: 400 })
    }

    const analysisResult = await supabase
      .from('observation_media_analyses')
      .select('*')
      .eq('user_id', user.id)
      .in('image_url', uniqueMediaUrls)

    if (analysisResult.error) {
      throw analysisResult.error
    }
    const analysisRows = (analysisResult.data || []) as ObservationMediaAnalysisRow[]
    const analysisMap = new Map<string, ObservationMediaAnalysisRow>(
      analysisRows.map((row) => [row.image_url, row]),
    )
    const imagesNeedingModeration = uniqueMediaUrls.filter(
      (url) => !isObservationAnalysisPassed(analysisMap.get(url)),
    )

    const moderation = await moderateUserContent({
      text: payload.items.map((item) => item.location_name).join('\n'),
      imageSources: imagesNeedingModeration,
    })
    if (moderation.state === 'rejected') {
      return NextResponse.json(
        { error: moderation.reason || '观察未通过安全检查', code: 'CONTENT_REJECTED' },
        { status: 422 },
      )
    }
    if (moderation.state === 'pending' && !supabaseAdmin) {
      return NextResponse.json(
        { error: '审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    for (const imageUrl of uniqueMediaUrls) {
      const analysis = analysisMap.get(imageUrl)
      if (moderation.state !== 'pending' && !isObservationAnalysisPassed(analysis)) {
        return NextResponse.json(
          { error: getObservationAnalysisErrorMessage(analysis) },
          { status: 400 },
        )
      }
    }

    const topicLookupIds = Array.from(new Set(
      payload.items.flatMap((item) => {
        const selected = item.initial_species_id ?? null
        const analysis = analysisMap.get(item.media_url)
        const ai = analysis ? selectAiIdentification([analysisVoteInput(analysis)]) : null
        return [selected, ai?.speciesId].filter((id): id is number => typeof id === 'number')
      }),
    ))

    const speciesTopicById = new Map<number, string | null>()
    if (topicLookupIds.length > 0) {
      const { data: speciesRows, error: speciesError } = await supabase
        .from('species')
        .select('id, nature_topic')
        .in('id', topicLookupIds)
      if (speciesError) throw speciesError
      for (const row of speciesRows || []) {
        speciesTopicById.set(row.id, row.nature_topic)
      }
    }

    const insertRows = payload.items.map((item) => {
      const analysis = analysisMap.get(item.media_url)
      const ai = analysis ? selectAiIdentification([analysisVoteInput(analysis)]) : null
      const topicLookupSpeciesId = item.initial_species_id ?? ai?.speciesId ?? null
      const inferredNatureTopic = (
        (topicLookupSpeciesId ? speciesTopicById.get(topicLookupSpeciesId) : null)
        ?? analysis?.nature_topic
        ?? null
      )

      return {
        user_id: user.id,
        nature_topic: inferredNatureTopic,
        observed_at: item.observed_at,
        observed_at_source: item.observed_at_source,
        location_name: item.location_name,
        latitude: item.latitude,
        longitude: item.longitude,
        location_precision: 'exact' as const,
        location_source: item.location_source,
        coordinate_system: item.coordinate_system,
        habitat: null,
        weather: null,
        notes: null,
        media_urls: [item.media_url],
        is_public: payload.is_public,
        status: 'pending' as const,
        moderation_state: moderation.state,
        lifecycle_stage: item.lifecycle_stage ?? null,
        sex: item.sex ?? null,
      }
    })

    const { data: observations, error: observationError } = await supabase
      .from('observation_events')
      .insert(insertRows)
      .select('*')

    if (observationError || !observations || observations.length !== payload.items.length) {
      throw observationError || new Error('Failed to create observations')
    }

    const created = observations as ObservationEventRow[]
    const createdIds = created.map((row) => row.id)
    const createdByUrl = new Map(created.map((row) => [row.media_urls[0], row]))

    const rollbackBatch = async () => {
      await rollbackCreatedObservations({
        supabase,
        userId: user.id,
        observationIds: createdIds,
      })
      if (supabaseAdmin) {
        const { error: caseRollbackError } = await supabaseAdmin
          .from('moderation_cases')
          .delete()
          .eq('content_type', 'observation')
          .in('content_id', createdIds)
        if (caseRollbackError) throw caseRollbackError
      }
    }

    let moderationCaseIds: number[] = []
    try {
      for (const item of payload.items) {
        const observation = createdByUrl.get(item.media_url)
        if (!observation) throw new Error('Failed to create observations')
        await attachIdentifications({
          supabase,
          observationId: observation.id,
          item,
          analysis: analysisMap.get(item.media_url),
        })
      }

      if (moderation.state === 'pending') {
        for (const observation of created) {
          const caseId = await createModerationCase({
            contentType: 'observation',
            contentId: observation.id,
            authorId: user.id,
            riskLevel: moderation.riskLevel,
            category: moderation.category,
            reason: moderation.reason,
            modelName: moderation.modelName,
            snapshot: {
              authorId: user.id,
              text: payload.items.map((item) => item.location_name).filter(Boolean).join('\n'),
              metadata: { mediaUrls: [observation.media_urls[0]].filter(Boolean) },
            },
          })
          if (caseId) moderationCaseIds.push(caseId)
        }
      }
    } catch (postInsertError) {
      try {
        await rollbackBatch()
      } catch (rollbackError) {
        logger.error('Failed to roll back observation batch', { rollbackError, postInsertError })
        throw rollbackError
      }
      throw postInsertError
    }

    const first = created[0]
    return NextResponse.json(
      moderationCaseIds.length > 0
        ? {
            observation: first,
            observations: created,
            reviewStatus: 'pending',
            moderation: { state: 'pending', caseIds: moderationCaseIds },
          }
        : { observation: first, observations: created, reviewStatus: 'pending' },
      { status: moderationCaseIds.length > 0 ? 202 : 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
