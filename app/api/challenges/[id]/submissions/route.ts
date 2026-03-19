import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured') === 'true'

    const { data: challenge } = await supabase
      .from('challenges')
      .select('challenge_type')
      .eq('id', challengeId)
      .single()

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    let query = supabase
      .from('projects')
      .select(`
        id, title, description, image_url, author_id, category,
        likes_count, status, difficulty_stars, created_at,
        reflection, problem_statement,
        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id)
      `)
      .eq('challenge_id', challengeId)
      .eq('status', 'approved')

    const { data: projects, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    const projectIds = (projects || []).map(p => (p as { id: number }).id)

    let ratingSummaries: Record<number, { avg_score: number; rating_count: number }> = {}

    if (projectIds.length > 0) {
      const { data: ratings } = await supabase
        .from('challenge_ratings')
        .select('project_id, creativity, practicality, technical, reflection_depth')
        .in('project_id', projectIds)

      if (ratings) {
        const grouped: Record<number, { sum: number; count: number }> = {}
        for (const r of ratings as { project_id: number; creativity: number; practicality: number; technical: number; reflection_depth: number }[]) {
          if (!grouped[r.project_id]) grouped[r.project_id] = { sum: 0, count: 0 }
          grouped[r.project_id].sum += (r.creativity + r.practicality + r.technical + r.reflection_depth) / 4
          grouped[r.project_id].count++
        }
        for (const [pid, val] of Object.entries(grouped)) {
          ratingSummaries[Number(pid)] = {
            avg_score: Math.round((val.sum / val.count) * 100) / 100,
            rating_count: val.count,
          }
        }
      }
    }

    let submissions = (projects || []).map(p => {
      const proj = p as Record<string, unknown>
      const pid = proj.id as number
      return {
        ...proj,
        rating_summary: ratingSummaries[pid] || { avg_score: 0, rating_count: 0 },
      }
    })

    if (featured) {
      submissions = submissions.filter(s => s.rating_summary.avg_score >= 4.0)
    }

    const challengeType = (challenge as { challenge_type: string }).challenge_type
    if (challengeType === 'timed') {
      submissions.sort((a, b) => b.rating_summary.avg_score - a.rating_summary.avg_score)
    }

    return NextResponse.json({ submissions })
  } catch (error) {
    logger.error('Error in GET /api/challenges/[id]/submissions', { error })
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}
