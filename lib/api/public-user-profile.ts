import { isUuid } from '@/lib/api/validation'
import {
  applyPublicClassificationVisibility,
  getContentClassificationSettings,
} from '@/lib/content-classification'
import { logger } from '@/lib/logger'
import { mapDbProject, type Project, type Work } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import { getUserWorks } from '@/lib/works/data'

export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  equipped_avatar_frame_id: string | null
  equipped_name_color_id: string | null
  equipped_title?: string | null
  featured_badge_ids?: string[] | null
  bio: string | null
  xp: number
  role?: 'user' | 'teacher' | 'moderator' | 'admin'
  message_privacy: string
  created_at: string
}

export interface PublicUserProfileData {
  profile: PublicProfile
  projects: Project[]
  projectsTotalCount: number
  works: Work[]
  worksTotalCount: number
  followerCount: number
  followingCount: number
  badgeIds: string[]
  hasMoreProjects: boolean
  hasMoreWorks: boolean
}

export const PUBLIC_PROFILE_PROJECTS_PAGE_SIZE = 12

const PUBLIC_PROFILE_PROJECT_SELECT = `
  id,
  title,
  author_id,
  image_url,
  category,
  sub_category_id,
  likes_count,
  views_count,
  coins_count,
  comments_count,
  description,
  difficulty,
  difficulty_stars,
  tags,
  status,
  rejection_reason,
  moderation_state,
  challenge_id,
  profiles:author_id (display_name),
  sub_categories (name)
`

function buildPublicProfileProjectSelect(includeClassification: boolean): string {
  if (!includeClassification) return PUBLIC_PROFILE_PROJECT_SELECT

  return `${PUBLIC_PROFILE_PROJECT_SELECT},
  recommended_min_age,
  recommended_max_age,
  support_level,
  classification_status,
  classification_source,
  classification_reviewed_at,
  classification_reviewed_by,
  classification_revision`
}

export async function getPublicUserProfile(
  userId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<PublicUserProfileData | null> {
  if (!isUuid(userId)) return null

  const supabase = await createClient()
  const page = Math.max(0, options.page ?? 0)
  const pageSize = Math.min(24, Math.max(1, options.pageSize ?? PUBLIC_PROFILE_PROJECTS_PAGE_SIZE))
  const from = page * pageSize
  const to = from + pageSize - 1
  const classificationSettings = await getContentClassificationSettings()
  const includeClassification = classificationSettings.publicV1Enabled || classificationSettings.enforcementEnabled

  let projectsQuery = supabase
    .from('projects')
    .select(buildPublicProfileProjectSelect(includeClassification), { count: 'exact' })
    .eq('author_id', userId)
    .eq('status', 'approved')
    .eq('moderation_state', 'approved')
  if (classificationSettings.enforcementEnabled) {
    projectsQuery = projectsQuery.eq('classification_status', 'reviewed')
  }
  projectsQuery = projectsQuery
    .order('created_at', { ascending: false })
    .range(from, to)

  const [
    profileResult,
    projectsResult,
    followerResult,
    followingResult,
    badgeResult,
    worksResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, equipped_title, featured_badge_ids, bio, xp, role, message_privacy, created_at')
      .eq('id', userId)
      .maybeSingle(),
    projectsQuery,
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', userId),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId),
    getUserWorks({ userId, page, pageSize, publicOnly: true }),
  ])

  if (profileResult.error) {
    logger.error('Error fetching public profile', { error: profileResult.error, userId })
    return null
  }

  if (!profileResult.data) {
    return null
  }

  if (projectsResult.error) {
    logger.error('Error fetching public profile projects', { error: projectsResult.error, userId })
  }

  if (followerResult.error) {
    logger.error('Error counting public profile followers', { error: followerResult.error, userId })
  }

  if (followingResult.error) {
    logger.error('Error counting public profile following', { error: followingResult.error, userId })
  }

  if (badgeResult.error) {
    logger.error('Error fetching public profile badges', { error: badgeResult.error, userId })
  }

  const projects = applyPublicClassificationVisibility(
    ((projectsResult.data || []) as unknown as Parameters<typeof mapDbProject>[0][]).map((row) => mapDbProject(row)),
    classificationSettings,
  )
  const projectsTotalCount = projectsResult.count || projects.length

  return {
    profile: profileResult.data as PublicProfile,
    projects,
    projectsTotalCount,
    works: worksResult.works,
    worksTotalCount: worksResult.total,
    followerCount: followerResult.count || 0,
    followingCount: followingResult.count || 0,
    badgeIds: ((badgeResult.data as { badge_id: string }[] | null) || []).map((row) => row.badge_id),
    hasMoreProjects: projectsTotalCount > to + 1,
    hasMoreWorks: worksResult.hasMore,
  }
}
