import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { ValidationError, validateContentSafeIfPresent } from '@/lib/api/validation'
import type { ChallengeStage } from '@/lib/mappers/types'
import {
  buildChallengePersonalPlan,
  mapChallengeWorkspace,
  normalizeProjectGoal,
  type ChallengeWorkspaceRow,
} from '@/lib/pbl/challenge-workspace'
import { ChallengeWorkspaceUpdateSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

function parseChallengeId(value: string) {
  const challengeId = Number.parseInt(value, 10)
  return Number.isNaN(challengeId) ? null : challengeId
}

async function loadChallengeForWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: number,
) {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, status, stages')
    .eq('id', challengeId)
    .maybeSingle()

  if (error) throw error
  return data as { id: number; status: string; stages: unknown } | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = parseChallengeId(id)
    if (!challengeId) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ workspace: null })
    }

    const { data, error } = await supabase
      .from('challenge_workspaces')
      .select('project_goal, personal_plan, updated_at')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      workspace: data ? mapChallengeWorkspace(data as ChallengeWorkspaceRow) : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenge-workspace', limit: 20, windowMs: 60_000 })

    const { id } = await params
    const challengeId = parseChallengeId(id)
    if (!challengeId) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = ChallengeWorkspaceUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const challenge = await loadChallengeForWorkspace(supabase, challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: '挑战未开放，项目方向仅可查看' }, { status: 400 })
    }
    await requireInteractionAccess(supabase, user, 'save_progress')

    const { project_goal: projectGoalInput } = parsed.data

    if (projectGoalInput === null) {
      const { error: deleteError } = await supabase
        .from('challenge_workspaces')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError
      return NextResponse.json({ workspace: null })
    }

    const projectGoal = normalizeProjectGoal(projectGoalInput)
    validateContentSafeIfPresent(projectGoal, '项目目标')

    if (!projectGoal) {
      const { error: deleteError } = await supabase
        .from('challenge_workspaces')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError
      return NextResponse.json({ workspace: null })
    }

    const stages = (Array.isArray(challenge.stages) ? challenge.stages : []) as ChallengeStage[]
    const personalPlan = buildChallengePersonalPlan({ projectGoal, stages })
    if (!personalPlan) {
      throw new ValidationError('项目目标不能为空')
    }

    const { data, error } = await supabase
      .from('challenge_workspaces')
      .upsert(
        {
          challenge_id: challengeId,
          user_id: user.id,
          project_goal: projectGoal,
          personal_plan: personalPlan as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'challenge_id,user_id' },
      )
      .select('project_goal, personal_plan, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({
      workspace: mapChallengeWorkspace(data as ChallengeWorkspaceRow),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
