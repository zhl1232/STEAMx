import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { getNaturalObservationProgressSummary } from '@/lib/api/nature-observation-progress'
import { logger } from '@/lib/logger'
import { type DbProject, mapProject } from '@/lib/mappers/project'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'
import { createClient } from '@/lib/supabase/server'
import { getUserWorks } from '@/lib/works/data'

const PROFILE_WORKS_PAGE_SIZE = 8

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    const [
      myProjectsResponse,
      followersResponse,
      followingResponse,
      likesResponse,
      collectionsResponse,
      likesReceivedResponse,
      naturalObservationProgress,
      radar,
      worksResult,
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('*, profiles:author_id (display_name)', { count: 'exact' })
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, PROFILE_WORKS_PAGE_SIZE - 1),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', user.id),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', user.id),
      supabase
        .from('likes')
        .select('project_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('collections')
        .select('project_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.rpc('sum_author_project_likes' as never, { p_author_id: user.id } as never),
      getNaturalObservationProgressSummary(supabase, user.id),
      getSteamRadarWithGuidanceSafe(supabase, user.id, 'GET /api/profile/summary'),
      getUserWorks({ userId: user.id, pageSize: PROFILE_WORKS_PAGE_SIZE }),
    ])

    if (myProjectsResponse.error) throw myProjectsResponse.error
    if (followersResponse.error) throw followersResponse.error
    if (followingResponse.error) throw followingResponse.error
    if (likesResponse.error) throw likesResponse.error
    if (collectionsResponse.error) throw collectionsResponse.error
    if (likesReceivedResponse.error) throw likesReceivedResponse.error

    const myProjects = ((myProjectsResponse.data as DbProject[] | null) || []).map((project) => mapProject(project))
    const totalLikesReceived = Number(likesReceivedResponse.data ?? 0)

    return NextResponse.json({
      myProjects,
      myProjectsTotalCount: myProjectsResponse.count || 0,
      myWorks: worksResult.works,
      myWorksTotalCount: worksResult.total,
      followerCount: followersResponse.count || 0,
      followingCount: followingResponse.count || 0,
      likedProjectsCount: likesResponse.count || 0,
      collectedProjectsCount: collectionsResponse.count || 0,
      completedProjectsCount: worksResult.total,
      totalLikesReceived,
      naturalObservationProgress,
      radar,
    })
  } catch (error) {
    logger.error('Error in GET /api/profile/summary', { error })
    return handleApiError(error)
  }
}
