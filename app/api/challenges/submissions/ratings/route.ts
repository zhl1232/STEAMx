import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getChallengeRatingSubmission } from '@/lib/api/project-access'
import { ChallengeSubmissionRatingSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json()
    const parsed = ChallengeSubmissionRatingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const submission = await getChallengeRatingSubmission(supabase, parsed.data.submissionId)
    if (!submission) {
      return NextResponse.json({ error: 'Challenge submission not found' }, { status: 404 })
    }

    if (submission.user_id === user.id) {
      return NextResponse.json({ error: '不能对自己的作品评分' }, { status: 403 })
    }

    await requireInteractionAccess(supabase, user, 'comment')

    const { data, error } = await supabase
      .from('challenge_submission_ratings')
      .upsert({
        submission_id: parsed.data.submissionId,
        user_id: user.id,
        creative_expression: parsed.data.creativeExpression,
        completion_quality: parsed.data.completionQuality,
        evidence_completeness: parsed.data.evidenceCompleteness,
        reflection_depth: parsed.data.reflectionDepth,
      } as never, { onConflict: 'submission_id,user_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ rating: data })
  } catch (error) {
    return handleApiError(error)
  }
}
