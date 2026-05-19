import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { getTrackedCompletedProjectIds } from '@/lib/completion-records'
import { logger } from '@/lib/logger'
import { type DbProject, mapProject } from '@/lib/mappers/project'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'
import { createClient } from '@/lib/supabase/server'

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
      completionRowsResponse,
      likesReceivedResponse,
      radar,
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
      supabase
        .from('completed_projects')
        .select('project_id, status, record_kind, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false }),
      supabase
        .from('projects')
        .select('likes_count')
        .eq('author_id', user.id),
      getSteamRadarWithGuidanceSafe(supabase, user.id, 'GET /api/profile/summary'),
    ])

    if (myProjectsResponse.error) throw myProjectsResponse.error
    if (followersResponse.error) throw followersResponse.error
    if (followingResponse.error) throw followingResponse.error
    if (likesResponse.error) throw likesResponse.error
    if (collectionsResponse.error) throw collectionsResponse.error
    if (completionRowsResponse.error) throw completionRowsResponse.error
    if (likesReceivedResponse.error) throw likesReceivedResponse.error

    const myProjects = ((myProjectsResponse.data as DbProject[] | null) || []).map((project) => mapProject(project))
    const completedProjectsCount = getTrackedCompletedProjectIds(
      (completionRowsResponse.data as {
        project_id: number
        status?: string | null
        record_kind?: string | null
      }[] | null) || [],
    ).length
    const totalLikesReceived = (((likesReceivedResponse.data as { likes_count?: number | null }[] | null) || [])).reduce(
      (sum, row) => sum + Number(row.likes_count || 0),
      0,
    )

    return NextResponse.json({
      myProjects,
      myProjectsTotalCount: myProjectsResponse.count || 0,
      followerCount: followersResponse.count || 0,
      followingCount: followingResponse.count || 0,
      likedProjectsCount: likesResponse.count || 0,
      collectedProjectsCount: collectionsResponse.count || 0,
      completedProjectsCount,
      totalLikesReceived,
      radar,
    })
  } catch (error) {
    logger.error('Error in GET /api/profile/summary', { error })
    return handleApiError(error)
  }
}
