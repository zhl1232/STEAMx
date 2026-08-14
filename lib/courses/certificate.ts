import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'

/**
 * 结课凭证：学完一门课后唯一可保存、可转发的成果物。
 * 只读本人的 `user_course_completions` 里程碑（RLS 已限定本人 / 审核员），
 * 再把这门课下自己的公开作品汇成一册。
 */

export interface CourseCertificateWork {
  id: number
  lessonTitle: string
  image: string | null
  completedAt: string
}

export interface CourseCertificate {
  courseId: number
  courseTitle: string
  courseImage: string | null
  learnerName: string
  learnerAvatar: string | null
  completedAtIso: string
  lessonCount: number
  difficultyStars: number
  works: CourseCertificateWork[]
  /** 已上传但还在审核里的作品数，用来解释作品册为什么少了几件 */
  pendingWorkCount: number
}

type Client = SupabaseClient<Database>

function formatWorkTitle(lessonTitle: string | null | undefined, index: number) {
  return lessonTitle?.trim() || `作品 ${index + 1}`
}

export async function getCourseCertificate(
  supabase: Client,
  args: { courseId: number; userId: string },
): Promise<CourseCertificate | null> {
  const [milestoneResult, courseResult, profileResult] = await Promise.all([
    supabase
      .from('user_course_completions')
      .select('completed_at, lesson_count_snapshot, difficulty_stars_snapshot')
      .eq('course_id', args.courseId)
      .eq('user_id', args.userId)
      .maybeSingle(),
    supabase.from('courses').select('id, title, image_url, status').eq('id', args.courseId).maybeSingle(),
    supabase.from('profiles').select('display_name, avatar_url').eq('id', args.userId).maybeSingle(),
  ])

  if (milestoneResult.error) throw milestoneResult.error
  if (courseResult.error) throw courseResult.error

  const milestone = milestoneResult.data
  const course = courseResult.data
  if (!milestone || !course || course.status !== 'approved') return null

  const { data: works, error: worksError } = await supabase
    .from('completed_projects')
    .select('id, proof_images, completed_at, status, is_public, moderation_state, course_lessons!inner(id, title, course_id)')
    .eq('user_id', args.userId)
    .eq('record_kind', 'final')
    .eq('course_lessons.course_id', args.courseId)
    .order('completed_at', { ascending: true })

  // 作品册取不到不该挡住凭证本身，凭证的依据是里程碑不是作品。
  if (worksError) logger.error('Failed to load course certificate works', { error: worksError })

  type WorkRow = {
    id: number
    proof_images: string[] | null
    completed_at: string | null
    status: string | null
    is_public: boolean | null
    moderation_state: string | null
    course_lessons?: { title: string | null } | null
  }

  // RLS 允许本人读到自己未过审的作品，但 /works/[id] 只放行公开且过审的，
  // 所以作品册按同一口径过滤，剩下的只报个数量，避免点进去 404。
  const workRows = (works ?? []) as unknown as WorkRow[]
  const visibleRows = workRows.filter(
    (row) => row.status === 'approved' && row.is_public === true && row.moderation_state === 'approved',
  )
  const pendingWorkCount = workRows.filter(
    (row) => row.status === 'pending' || row.moderation_state === 'pending',
  ).length

  return {
    courseId: course.id,
    courseTitle: course.title,
    courseImage: course.image_url,
    learnerName: profileResult.data?.display_name || '这位小创客',
    learnerAvatar: profileResult.data?.avatar_url ?? null,
    completedAtIso: milestone.completed_at,
    lessonCount: milestone.lesson_count_snapshot,
    difficultyStars: milestone.difficulty_stars_snapshot,
    works: visibleRows.map((row, index) => ({
      id: row.id,
      lessonTitle: formatWorkTitle(row.course_lessons?.title, index),
      image: row.proof_images?.[0] ?? null,
      completedAt: row.completed_at ?? milestone.completed_at,
    })),
    pendingWorkCount,
  }
}

export function formatCertificateDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
