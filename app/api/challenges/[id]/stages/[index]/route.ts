import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { getStageProgressForStage } from '@/lib/api/challenge-stage-progress'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  ValidationError,
  validateContentSafeIfPresent,
  validateOwnedOrTrustedProjectImageUrl,
} from '@/lib/api/validation'
import { ChallengeStageProgressSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const STAGE_IMAGE_OPTIONS = { bucket: 'project-completions', pathPrefix: 'challenge-submissions' } as const

async function loadChallengeStageBounds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: number,
) {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, status, stages')
    .eq('id', challengeId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const stages = Array.isArray((data as { stages?: unknown }).stages)
    ? ((data as { stages: unknown[] }).stages)
    : []

  return { status: (data as { status: string }).status, stageCount: stages.length }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenge-stage-progress', limit: 30, windowMs: 60_000 })

    const { id, index } = await params
    const challengeId = Number.parseInt(id, 10)
    const stageIndex = Number.parseInt(index, 10)
    if (Number.isNaN(challengeId) || Number.isNaN(stageIndex) || stageIndex < 0) {
      return NextResponse.json({ error: 'Invalid challenge or stage index' }, { status: 400 })
    }

    const challenge = await loadChallengeStageBounds(supabase, challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: '挑战未开放，阶段产出仅可查看' }, { status: 400 })
    }
    if (stageIndex >= challenge.stageCount) {
      return NextResponse.json({ error: '阶段不存在' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = ChallengeStageProgressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    validateContentSafeIfPresent(parsed.data.notes, '阶段说明')
    for (const image of parsed.data.images) {
      validateOwnedOrTrustedProjectImageUrl(image, user.id, '阶段图片', STAGE_IMAGE_OPTIONS)
    }
    if (parsed.data.video_url) {
      validateOwnedOrTrustedProjectImageUrl(parsed.data.video_url, user.id, '阶段视频', {
        bucket: 'project-completion-videos',
      })
    }

    const { error: upsertError } = await supabase
      .from('challenge_stage_progress')
      .upsert(
        {
          challenge_id: challengeId,
          user_id: user.id,
          stage_index: stageIndex,
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
          images: parsed.data.images,
          data: (parsed.data.data ?? null) as Json | null,
          video_url: parsed.data.video_url ?? null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'challenge_id,user_id,stage_index' },
      )

    if (upsertError) throw upsertError

    const progress = await getStageProgressForStage(supabase, challengeId, user.id, stageIndex)
    return NextResponse.json({ progress })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}
