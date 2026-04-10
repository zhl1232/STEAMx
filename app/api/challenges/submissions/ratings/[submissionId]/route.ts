import { NextRequest, NextResponse } from 'next/server'

import { getChallengeRatingSubmission } from '@/lib/api/project-access'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const supabase = await createClient()

  try {
    const { submissionId } = await params
    const id = Number.parseInt(submissionId, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Submission id must be a number' }, { status: 400 })
    }

    const submission = await getChallengeRatingSubmission(supabase, id)
    if (!submission) {
      return NextResponse.json({ error: 'Challenge submission not found' }, { status: 404 })
    }

    const { data: ratings, error } = await supabase
      .from('challenge_submission_ratings')
      .select('creative_expression, completion_quality, evidence_completeness, reflection_depth, user_id')
      .eq('submission_id', id)

    if (error) throw error

    const allRatings = (ratings || []) as {
      creative_expression: number
      completion_quality: number
      evidence_completeness: number
      reflection_depth: number
      user_id: string
    }[]

    const count = allRatings.length
    const summary = {
      avgCreativeExpression: count ? Math.round(allRatings.reduce((sum, row) => sum + row.creative_expression, 0) / count * 100) / 100 : 0,
      avgCompletionQuality: count ? Math.round(allRatings.reduce((sum, row) => sum + row.completion_quality, 0) / count * 100) / 100 : 0,
      avgEvidenceCompleteness: count ? Math.round(allRatings.reduce((sum, row) => sum + row.evidence_completeness, 0) / count * 100) / 100 : 0,
      avgReflectionDepth: count ? Math.round(allRatings.reduce((sum, row) => sum + row.reflection_depth, 0) / count * 100) / 100 : 0,
      avgScore: 0,
      ratingCount: count,
    }

    summary.avgScore = Math.round(
      ((summary.avgCreativeExpression + summary.avgCompletionQuality + summary.avgEvidenceCompleteness + summary.avgReflectionDepth) / 4) * 100,
    ) / 100

    const { data: { user } } = await supabase.auth.getUser()
    let myRating = null

    if (user) {
      const found = allRatings.find((row) => row.user_id === user.id)
      if (found) {
        myRating = {
          creativeExpression: found.creative_expression,
          completionQuality: found.completion_quality,
          evidenceCompleteness: found.evidence_completeness,
          reflectionDepth: found.reflection_depth,
        }
      }
    }

    return NextResponse.json({ summary, myRating })
  } catch (error) {
    logger.error('Error in GET /api/challenges/submissions/ratings/[submissionId]', { error })
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}
