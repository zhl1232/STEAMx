import { NextRequest, NextResponse } from 'next/server'

import { getStageCoachUserMessage, reviewStageArtifact } from '@/lib/ai/pbl-stage-coach'
import { consumeAiCredit, refundAiCredit } from '@/lib/api/ai-credits'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getStageProgressByUser, getStageProgressForStage } from '@/lib/api/challenge-stage-progress'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  ValidationError,
  validateContentSafeIfPresent,
  validateOwnedOrTrustedProjectImageUrl,
} from '@/lib/api/validation'
import type { ChallengeStage } from '@/lib/mappers/types'
import { getAiChatCreditCost, getMembershipSummary } from '@/lib/membership'
import {
  buildStageReviewArtifact,
  buildStageReviewContext,
} from '@/lib/pbl/challenge-stage-review'
import { getStageDataSummary } from '@/lib/pbl/challenge-stage-progress'
import { mapChallengeWorkspace, type ChallengeWorkspaceRow } from '@/lib/pbl/challenge-workspace'
import { ChallengeStageCoachSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

const STAGE_IMAGE_OPTIONS = { bucket: 'project-completions', pathPrefix: 'challenge-submissions' } as const

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function hasReviewableStructuredData(data: Record<string, unknown> | null) {
  if (!data) return false
  return Object.values(data).some((value) => {
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return value !== null && value !== undefined
  })
}

async function loadChallengeForStageReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: number,
) {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, status, driving_question, constraints, stages')
    .eq('id', challengeId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: Number(data.id),
    title: String(data.title ?? ''),
    status: String(data.status ?? ''),
    drivingQuestion: typeof data.driving_question === 'string' ? data.driving_question : null,
    constraints: Array.isArray(data.constraints) ? (data.constraints as string[]) : null,
    stages: (Array.isArray(data.stages) ? data.stages : []) as unknown as ChallengeStage[],
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenge-stage-review', limit: 6, windowMs: 60_000 })

    const { id, index } = await params
    const challengeId = parsePositiveInteger(id)
    const stageIndex = parsePositiveInteger(index)
    if (challengeId === null || stageIndex === null || stageIndex < 0) {
      return NextResponse.json({ error: 'Invalid challenge or stage index' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = ChallengeStageCoachSchema.safeParse({ ...body, mode: 'review' })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const notes = parsed.data.notes?.trim() ?? ''
    const images = parsed.data.images
    const data = typeof parsed.data.data === 'object' && parsed.data.data !== null
      ? parsed.data.data as Record<string, unknown>
      : null
    if (!notes && images.length === 0 && !hasReviewableStructuredData(data)) {
      return NextResponse.json({ error: '请先填写这一步的产出或上传图片' }, { status: 400 })
    }

    validateContentSafeIfPresent(notes, '阶段说明')
    validateContentSafeIfPresent(getStageDataSummary(data), '阶段补充记录')
    for (const image of images) {
      validateOwnedOrTrustedProjectImageUrl(image, user.id, '阶段图片', STAGE_IMAGE_OPTIONS)
    }

    const challenge = await loadChallengeForStageReview(supabase, challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: '挑战未开放，阶段反馈仅可查看' }, { status: 400 })
    }
    if (stageIndex >= challenge.stages.length) {
      return NextResponse.json({ error: '阶段不存在' }, { status: 400 })
    }
    await requireInteractionAccess(supabase, user, 'save_progress')

    const stage = challenge.stages[stageIndex]

    const existingProgress = await getStageProgressForStage(supabase, challengeId, user.id, stageIndex)
    const nextStatus = existingProgress?.status === 'completed' ? 'completed' : 'in_progress'
    const now = new Date().toISOString()
    const { error: progressSaveError } = await supabase
      .from('challenge_stage_progress')
      .upsert(
        {
          challenge_id: challengeId,
          user_id: user.id,
          stage_index: stageIndex,
          status: nextStatus,
          notes: notes || null,
          images,
          data: (data ?? null) as Json | null,
          ai_feedback: null,
          updated_at: now,
        } as never,
        { onConflict: 'challenge_id,user_id,stage_index' },
      )

    if (progressSaveError) throw progressSaveError

    const [{ data: profile, error: profileError }, workspaceResponse] = await Promise.all([
      supabase
        .from('profiles')
        .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('challenge_workspaces')
        .select('project_goal, personal_plan, updated_at')
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (profileError) throw profileError
    if (workspaceResponse.error) throw workspaceResponse.error

    const cost = getAiChatCreditCost(images.length > 0)
    const creditResult = await consumeAiCredit(supabase, profile, cost)
    if (!creditResult.ok) {
      const progress = await getStageProgressForStage(supabase, challengeId, user.id, stageIndex)
      return NextResponse.json(
        {
          error: '今日免费次数或本月代币已用完',
          code: 'quota_exceeded',
          resetAt: creditResult.resetAt,
          membership: getMembershipSummary(profile),
          progress,
        },
        { status: 402 },
      )
    }

    try {
      const progressList = await getStageProgressByUser(supabase, challengeId, user.id)
      const workspace = workspaceResponse.data
        ? mapChallengeWorkspace(workspaceResponse.data as ChallengeWorkspaceRow)
        : null
      const artifact = buildStageReviewArtifact({ notes, images, data, stage })
      const feedback = await reviewStageArtifact(
        buildStageReviewContext({
          challenge,
          stages: challenge.stages,
          stageIndex,
          progressList,
          workspace,
        }),
        artifact,
      )

      const { error: feedbackSaveError } = await supabase
        .from('challenge_stage_progress')
        .update({
          ai_feedback: feedback as unknown as Json,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .eq('stage_index', stageIndex)

      if (feedbackSaveError) throw feedbackSaveError

      const progress = await getStageProgressForStage(supabase, challengeId, user.id, stageIndex)
      return NextResponse.json({ feedback, progress })
    } catch (error) {
      if (creditResult.source) {
        await refundAiCredit(supabase, cost, creditResult.source).catch(() => undefined)
      }
      const progress = await getStageProgressForStage(supabase, challengeId, user.id, stageIndex)
      return NextResponse.json({ error: getStageCoachUserMessage(error), progress }, { status: 502 })
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}
