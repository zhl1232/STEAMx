import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  mapAnalysisRowToResponse,
  type ObservationMediaAnalysisRow,
  type ObservationMediaAnalysisStatus,
} from '@/lib/ai/observation-media-analysis'
import {
  analyzeObservationImageWithQwen,
  getObservationVisionUserMessage,
  serializeObservationVisionError,
} from '@/lib/ai/qwen-vision'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { isOwnedProjectImageUrl } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const relativeOrAbsoluteUrlSchema = z.union([
  z.string().url(),
  z.string().min(1).startsWith('/'),
])

const MediaAnalysisSchema = z.object({
  imageUrls: z.array(relativeOrAbsoluteUrlSchema).min(1).max(5),
  topic: z.enum(['birds', 'plants']),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-observation-media-analysis', limit: 12, windowMs: 60_000 })

    const body = await request.json()
    const parsed = MediaAnalysisSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const imageUrls = Array.from(new Set(parsed.data.imageUrls))
    const topic = parsed.data.topic
    if (imageUrls.some((url) => !isOwnedProjectImageUrl(url, user.id, 'observations'))) {
      return NextResponse.json({ error: '只能识别当前账号上传的观察图片' }, { status: 400 })
    }

    const { data: speciesRows, error: speciesError } = await supabase
      .from('species')
      .select('*')
      .eq('is_active', true)
      .eq('nature_topic', topic)

    if (speciesError || !speciesRows) {
      throw speciesError || new Error('Failed to load species')
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('observation_media_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('nature_topic', topic)
      .in('image_url', imageUrls)

    if (existingError) {
      throw existingError
    }

    const existingMap = new Map<string, ObservationMediaAnalysisRow>(
      ((existingRows || []) as ObservationMediaAnalysisRow[]).map((row) => [row.image_url, row]),
    )

    const finalStatuses = new Set<ObservationMediaAnalysisStatus>([
      'passed',
      'passed_no_identification',
      'failed_unsafe',
      'failed_low_quality',
      'failed_unrecognized',
      'error',
    ])

    const toAnalyze = imageUrls.filter((url) => {
      const existing = existingMap.get(url)
      if (!existing) return true

      const status = existing.status as ObservationMediaAnalysisStatus
      return !finalStatuses.has(status)
    })

    if (toAnalyze.length > 0) {
      const { error: pendingError } = await supabase
        .from('observation_media_analyses')
        .upsert(
          toAnalyze.map((imageUrl) => ({
            user_id: user.id,
            image_url: imageUrl,
            nature_topic: topic,
            status: 'pending',
          })),
          { onConflict: 'user_id,image_url,nature_topic' },
        )

      if (pendingError) {
        throw pendingError
      }
    }

    await Promise.all(
      toAnalyze.map(async (imageUrl) => {
        try {
          const result = await analyzeObservationImageWithQwen(imageUrl, speciesRows, topic)

          const { error } = await supabase
            .from('observation_media_analyses')
            .update({
              status: result.status,
              model_name: result.modelName,
              moderation_pass: result.moderationPass,
              moderation_reason: result.moderationReason,
              quality_pass: result.qualityPass,
              quality_reason: result.qualityReason,
              note_suggestion: result.noteSuggestion,
              species_candidates: result.speciesCandidates as unknown as Json,
              raw_response: result.rawResponse as Json,
            })
            .eq('user_id', user.id)
            .eq('nature_topic', topic)
            .eq('image_url', imageUrl)

          if (error) {
            throw error
          }
        } catch (error) {
          const failureReason = getObservationVisionUserMessage(error)
          logger.error('Observation media analysis failed', { error, imageUrl, userId: user.id })
          await supabase
            .from('observation_media_analyses')
            .update({
              status: 'error',
              moderation_reason: failureReason,
              quality_reason: null,
              note_suggestion: null,
              raw_response: serializeObservationVisionError(error) as Json,
            })
            .eq('user_id', user.id)
            .eq('nature_topic', topic)
            .eq('image_url', imageUrl)
        }
      }),
    )

    const { data: refreshedRows, error: refreshedError } = await supabase
      .from('observation_media_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('nature_topic', topic)
      .in('image_url', imageUrls)

    if (refreshedError) {
      throw refreshedError
    }

    const rows = ((refreshedRows || []) as ObservationMediaAnalysisRow[]).sort(
      (left, right) => imageUrls.indexOf(left.image_url) - imageUrls.indexOf(right.image_url),
    )

    return NextResponse.json({
      analyses: rows.map(mapAnalysisRowToResponse),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
