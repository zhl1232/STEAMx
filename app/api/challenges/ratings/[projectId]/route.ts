import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateNumber } from '@/lib/api/validation'
import { getChallengeRatingProject } from '@/lib/api/project-access'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient()

  try {
    const { projectId } = await params
    const pid = validateNumber(projectId, 'Project id', { integer: true, min: 1 })

    const project = await getChallengeRatingProject(supabase, pid)
    if (!project) {
      return NextResponse.json({ error: 'Challenge project not found' }, { status: 404 })
    }

    const { data: ratings, error } = await supabase
      .from('challenge_ratings')
      .select('creativity, practicality, technical, reflection_depth, user_id')
      .eq('project_id', pid)

    if (error) throw error

    const allRatings = (ratings || []) as {
      creativity: number
      practicality: number
      technical: number
      reflection_depth: number
      user_id: string
    }[]

    const count = allRatings.length

    const summary = {
      avgCreativity: count ? Math.round(allRatings.reduce((s, r) => s + r.creativity, 0) / count * 100) / 100 : 0,
      avgPracticality: count ? Math.round(allRatings.reduce((s, r) => s + r.practicality, 0) / count * 100) / 100 : 0,
      avgTechnical: count ? Math.round(allRatings.reduce((s, r) => s + r.technical, 0) / count * 100) / 100 : 0,
      avgReflectionDepth: count ? Math.round(allRatings.reduce((s, r) => s + r.reflection_depth, 0) / count * 100) / 100 : 0,
      totalScore: 0,
      ratingCount: count,
    }

    summary.totalScore = Math.round(
      (summary.avgCreativity + summary.avgPracticality + summary.avgTechnical + summary.avgReflectionDepth) / 4 * 100
    ) / 100

    // Include current user's rating if authenticated
    const { data: { user } } = await supabase.auth.getUser()
    let myRating = null

    if (user) {
      const found = allRatings.find(r => r.user_id === user.id)
      if (found) {
        myRating = {
          creativity: found.creativity,
          practicality: found.practicality,
          technical: found.technical,
          reflectionDepth: found.reflection_depth,
        }
      }
    }

    return NextResponse.json({ summary, myRating })
  } catch (error) {
    logger.error('Error in GET /api/challenges/ratings/[projectId]', { error })
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}
