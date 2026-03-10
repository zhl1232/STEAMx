import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, xp, created_at')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ eligibility: null })
    }

    if ((profile as { role?: string }).role !== 'user') {
      return NextResponse.json({ eligibility: null })
    }

    const xp = (profile as { xp?: number | null }).xp || 0
    const level = Math.floor(Math.sqrt(xp / 100)) + 1

    const [
      { count: publishedCount },
      { count: completedCount },
      { count: commentsCount },
      { count: badgesCount },
      { count: rejectedProjects },
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id)
        .eq('status', 'approved'),
      supabase
        .from('completed_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('proof_images', 'is', null),
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id),
      supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id)
        .eq('status', 'rejected'),
    ])

    const accountAge = Math.floor(
      (Date.now() - new Date((profile as { created_at?: string | null }).created_at || Date.now()).getTime()) /
        (1000 * 60 * 60 * 24)
    )

    const hasViolations = (rejectedProjects || 0) > 0

    const requirements = {
      level: { met: level >= 5, current: level, required: 5 },
      publishedProjects: { met: (publishedCount || 0) >= 3, current: publishedCount || 0, required: 3 },
      completedProjects: { met: (completedCount || 0) >= 5, current: completedCount || 0, required: 5 },
      commentsCount: { met: (commentsCount || 0) >= 30, current: commentsCount || 0, required: 30 },
      badges: { met: (badgesCount || 0) >= 2, current: badgesCount || 0, required: 2 },
      accountAge: { met: accountAge >= 14, current: accountAge, required: 14 },
      violations: { met: !hasViolations },
    }

    const score =
      (requirements.level.met ? 30 : 0) +
      (requirements.publishedProjects.met ? 25 : 0) +
      (requirements.completedProjects.met ? 15 : 0) +
      (requirements.commentsCount.met ? 15 : 0) +
      (requirements.badges.met ? 10 : 0) +
      (requirements.accountAge.met ? 5 : 0)

    const isEligible = score >= 80 && !hasViolations

    return NextResponse.json({
      eligibility: { isEligible, score, requirements },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
