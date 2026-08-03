import { NextRequest, NextResponse } from 'next/server'

import { generateChallengeSubmissionDraft, getStageCoachUserMessage } from '@/lib/ai/pbl-stage-coach'
import { consumeAiCredit, refundAiCredit } from '@/lib/api/ai-credits'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getStageProgressByUser } from '@/lib/api/challenge-stage-progress'
import { requireRateLimit } from '@/lib/api/rate-limit'
import type { ChallengeStage } from '@/lib/mappers/types'
import { getAiChatCreditCost, getMembershipSummary } from '@/lib/membership'
import {
  buildChallengeSubmissionDraft,
  type ChallengeForSubmissionDraft,
} from '@/lib/pbl/challenge-submission-draft'
import { buildStageProgressSummary } from '@/lib/pbl/challenge-stage-review'
import { mapChallengeWorkspace, type ChallengeWorkspaceRow } from '@/lib/pbl/challenge-workspace'
import { createClient } from '@/lib/supabase/server'

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseSteamWeights(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

async function loadChallengeForDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: number,
) {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, status, driving_question, expected_outcome, constraints, stages, steam_weights')
    .eq('id', challengeId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: Number(data.id),
    title: String(data.title ?? ''),
    status: String(data.status ?? ''),
    challenge: {
      title: String(data.title ?? ''),
      drivingQuestion: typeof data.driving_question === 'string' ? data.driving_question : null,
      expectedOutcome: typeof data.expected_outcome === 'string' ? data.expected_outcome : null,
      constraints: Array.isArray(data.constraints) ? (data.constraints as string[]) : null,
      steamWeights: parseSteamWeights(data.steam_weights),
    } satisfies ChallengeForSubmissionDraft,
    stages: (Array.isArray(data.stages) ? data.stages : []) as unknown as ChallengeStage[],
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, { key: 'api-challenge-submission-draft', limit: 6, windowMs: 60_000 })

    const { id } = await params
    const challengeId = parsePositiveInteger(id)
    if (challengeId === null) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as { use_ai?: unknown }
    const useAi = body.use_ai !== false

    const [challengeData, progressList, workspaceResponse] = await Promise.all([
      loadChallengeForDraft(supabase, challengeId),
      getStageProgressByUser(supabase, challengeId, user.id),
      supabase
        .from('challenge_workspaces')
        .select('project_goal, personal_plan, updated_at')
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (!challengeData) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (workspaceResponse.error) throw workspaceResponse.error

    const workspace = workspaceResponse.data
      ? mapChallengeWorkspace(workspaceResponse.data as ChallengeWorkspaceRow)
      : null

    const fallback = buildChallengeSubmissionDraft({
      challenge: challengeData.challenge,
      stages: challengeData.stages,
      progressList,
      workspace,
    })

    if (!useAi) {
      return NextResponse.json({ draft: fallback, warning: null })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const cost = getAiChatCreditCost(false)
    const creditResult = await consumeAiCredit(supabase, profile, cost)
    if (!creditResult.ok) {
      return NextResponse.json(
        {
          error: '今日免费次数或本月代币已用完',
          code: 'quota_exceeded',
          resetAt: creditResult.resetAt,
          membership: getMembershipSummary(profile),
          draft: fallback,
        },
        { status: 402 },
      )
    }

    try {
      const progressSummary = buildStageProgressSummary({
        stages: challengeData.stages,
        progressList,
        currentStageIndex: Math.max(challengeData.stages.length - 1, 0),
        workspace,
      })
      const constraints = challengeData.challenge.constraints?.length
        ? `约束：${challengeData.challenge.constraints.join('；')}`
        : ''
      const contextText = [
        `挑战：${challengeData.challenge.title}`,
        challengeData.challenge.drivingQuestion ? `驱动问题：${challengeData.challenge.drivingQuestion}` : '',
        challengeData.challenge.expectedOutcome ? `目标产出：${challengeData.challenge.expectedOutcome}` : '',
        constraints,
        progressSummary,
      ].filter(Boolean).join('\n')

      const draft = await generateChallengeSubmissionDraft({ contextText, fallback })
      return NextResponse.json({ draft, warning: null })
    } catch (error) {
      if (creditResult.source) {
        await refundAiCredit(supabase, cost, creditResult.source).catch(() => undefined)
      }
      return NextResponse.json({ draft: fallback, warning: getStageCoachUserMessage(error) })
    }
  } catch (error) {
    return handleApiError(error)
  }
}
