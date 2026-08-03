import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import {
  validateChallengeSubmissionContent,
  validateChallengeSubmissionMediaOwnership,
} from '@/lib/api/challenge-submission-validation'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getChallengeSubmissionByUser } from '@/lib/api/challenge-submissions'
import { ChallengeSubmissionSchema } from '@/lib/schemas'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

async function getActiveChallenge(supabase: Awaited<ReturnType<typeof createClient>>, challengeId: number) {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, status')
    .eq('id', challengeId)
    .maybeSingle()

  if (error) throw error
  return data as { id: number; title: string; status: string } | null
}

async function validateReferenceProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: number,
  referenceProjectIds: number[],
) {
  if (referenceProjectIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .in('id', referenceProjectIds)
    .eq('challenge_id', challengeId)
    .eq('status', 'approved')

  if (error) throw error

  const validIds = new Set(((data || []) as { id: number }[]).map((project) => project.id))
  if (validIds.size !== referenceProjectIds.length) {
    throw new Error('部分参考项目不存在或不可关联')
  }

  return referenceProjectIds
}

async function ensureParticipant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  challengeId: number,
) {
  const { data, error } = await supabase
    .from('challenge_participants')
    .insert({ user_id: userId, challenge_id: challengeId } as never)
    .select('challenge_id')

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return
    }
    throw error
  }

  if (data && data.length > 0) {
    const { error: rpcError } = await callRpc(supabase, 'increment_challenge_participants', {
      challenge_id: challengeId,
    })
    if (rpcError) throw rpcError
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const submission = await getChallengeSubmissionByUser(supabase, challengeId, user.id)
    return NextResponse.json({ submission })
  } catch (error) {
    if (error instanceof Error && error.message === '部分参考项目不存在或不可关联') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenge-submission-create', limit: 6, windowMs: 60_000 })

    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const challenge = await getActiveChallenge(supabase, challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: 'Only active challenges accept submissions' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = ChallengeSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }
    validateChallengeSubmissionContent(parsed.data)
    validateChallengeSubmissionMediaOwnership(parsed.data, user.id)

    const existing = await getChallengeSubmissionByUser(supabase, challengeId, user.id)
    if (existing) {
      return NextResponse.json({ error: 'Submission already exists' }, { status: 409 })
    }

    await requireInteractionAccess(supabase, user, 'submit')

    const referenceProjectIds = await validateReferenceProjects(
      supabase,
      challengeId,
      parsed.data.reference_project_ids,
    )

    const { data: submission, error } = await supabase
      .from('challenge_submissions')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
        proof_images: parsed.data.proof_images,
        proof_captions: parsed.data.proof_captions?.length ? parsed.data.proof_captions : null,
        proof_video_url: parsed.data.proof_video_url ?? null,
        is_public: parsed.data.is_public,
        status: 'pending',
        updated_at: new Date().toISOString(),
      } as never)
      .select('*')
      .single()

    if (error || !submission) {
      throw error || new Error('Failed to create submission')
    }

    if (referenceProjectIds.length > 0) {
      const { error: linkError } = await supabase
        .from('challenge_submission_projects')
        .insert(referenceProjectIds.map((projectId, index) => ({
          submission_id: submission.id,
          project_id: projectId,
          sort_order: index,
        })) as never)

      if (linkError) {
        throw linkError
      }
    }

    await ensureParticipant(supabase, user.id, challengeId)

    const mapped = await getChallengeSubmissionByUser(supabase, challengeId, user.id)
    return NextResponse.json({ submission: mapped }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === '部分参考项目不存在或不可关联') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenge-submission-update', limit: 10, windowMs: 60_000 })

    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const challenge = await getActiveChallenge(supabase, challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: 'Challenge已结束，作品仅可查看' }, { status: 400 })
    }

    await requireInteractionAccess(supabase, user, 'submit')

    const body = await request.json()
    const parsed = ChallengeSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }
    validateChallengeSubmissionContent(parsed.data)
    validateChallengeSubmissionMediaOwnership(parsed.data, user.id)

    const current = await getChallengeSubmissionByUser(supabase, challengeId, user.id)
    if (!current) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const referenceProjectIds = await validateReferenceProjects(
      supabase,
      challengeId,
      parsed.data.reference_project_ids,
    )

    const nextStatus = current.status === 'approved' ? 'pending' : current.status || 'pending'
    const { error: updateError } = await supabase
      .from('challenge_submissions')
      .update({
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
        proof_images: parsed.data.proof_images,
        proof_captions: parsed.data.proof_captions?.length ? parsed.data.proof_captions : null,
        proof_video_url: parsed.data.proof_video_url ?? null,
        is_public: parsed.data.is_public,
        status: nextStatus,
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', current.id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    const { error: deleteLinksError } = await supabase
      .from('challenge_submission_projects')
      .delete()
      .eq('submission_id', current.id)

    if (deleteLinksError) throw deleteLinksError

    if (referenceProjectIds.length > 0) {
      const { error: linkError } = await supabase
        .from('challenge_submission_projects')
        .insert(referenceProjectIds.map((projectId, index) => ({
          submission_id: current.id,
          project_id: projectId,
          sort_order: index,
        })) as never)

      if (linkError) throw linkError
    }

    const mapped = await getChallengeSubmissionByUser(supabase, challengeId, user.id)
    return NextResponse.json({ submission: mapped })
  } catch (error) {
    return handleApiError(error)
  }
}
