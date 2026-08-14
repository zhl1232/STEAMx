import { NextRequest, NextResponse } from 'next/server'

import { getLessonInCourse, getUserLessonProgress, upsertUserLessonProgress } from '@/lib/api/courses'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

/**
 * POST — 记下「这节课打开过」。
 *
 * 在此之前 `user_lesson_progress` 只有点「完成课时」才会建行（积木课连
 * Scratch 保存那条路径都没有），于是「开始第一节课」和「学完第一节课」永远
 * 同时发生，新手引导第一步等于摆设。这里只建一行 `completed_at IS NULL` 的
 * 记录，课程进度统计一律跳过未完成行，不会把没学完的课算成学完。
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { courseId: courseIdRaw, lessonId: lessonIdRaw } = await params
  const courseId = Number(courseIdRaw)
  const lessonId = Number(lessonIdRaw)

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0 ||
    !Number.isInteger(lessonId) ||
    lessonId <= 0
  ) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, {
      key: 'api-courses-start-lesson',
      limit: 60,
      windowMs: 60_000,
    })

    const ctx = await getLessonInCourse(supabase, courseId, lessonId)
    if (!ctx) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const existing = await getUserLessonProgress(supabase, user.id, lessonId)
    if (existing) {
      return NextResponse.json({ started: true, alreadyStarted: true })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
    }

    await upsertUserLessonProgress(supabaseAdmin, { userId: user.id, lessonId })
    return NextResponse.json({ started: true, alreadyStarted: false })
  } catch (error) {
    logger.error('POST lesson start failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}
