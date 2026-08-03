import { NextRequest, NextResponse } from 'next/server'

import { getLessonInCourse, getUserLessonProgress } from '@/lib/api/courses'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { extractOpcodesFromSb3, checkRequiredBlocks } from '@/lib/courses/scratch-validate'
import type {
  CourseCompletionState,
  LessonRequiredBlock,
  UserLessonProgressRow,
} from '@/lib/courses/types'
import { logger } from '@/lib/logger'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

type CompletionRpcResult = {
  progress: UserLessonProgressRow
  already_completed: boolean
  completed_lesson_count: number
  total_lesson_count: number
  status: 'not_started' | 'in_progress' | 'completed'
  next_lesson_id: number | null
  milestone_completed_at: string | null
  course_completion_created: boolean
  course_completion_state: CourseCompletionState
}

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
      key: 'api-courses-complete-lesson',
      limit: 20,
      windowMs: 60_000,
    })
    const ctx = await getLessonInCourse(supabase, courseId, lessonId)
    if (!ctx) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const progress = await getUserLessonProgress(supabase, user.id, lessonId)
    const scratchProjectPath = progress?.scratch_project_path ?? null
    const trustedCompleted =
      Boolean(progress?.completed_at) &&
      (progress?.completion_source === 'server_v1' ||
        progress?.completion_source === 'staff_verified')
    const shouldValidateLesson = !trustedCompleted

    // Trusted server completions can reconcile without reopening Scratch. A
    // legacy client-written row must pass the current lesson checks first.
    if (shouldValidateLesson && ctx.lesson.lesson_type === 'scratch' && !scratchProjectPath) {
      return NextResponse.json(
        { error: '请先保存 Scratch 作品再标记完成' },
        { status: 400 },
      )
    }

    const requiredBlocks =
      ctx.lesson.lesson_type === 'scratch'
        ? ((ctx.lesson.content?.requiredBlocks ?? []) as LessonRequiredBlock[])
        : []
    if (shouldValidateLesson && requiredBlocks.length > 0) {
      if (!scratchProjectPath || !supabaseAdmin) {
        return NextResponse.json(
          { error: !scratchProjectPath ? '请先保存 Scratch 作品再标记完成' : '服务端配置异常' },
          { status: !scratchProjectPath ? 400 : 500 },
        )
      }
      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from('scratch-projects')
        .download(scratchProjectPath)
      if (downloadError || !file) {
        logger.warn('Lesson complete: sb3 download failed', { downloadError, lessonId })
        return NextResponse.json(
          { error: '无法读取你的作品，请重新保存后再试' },
          { status: 400 }
        )
      }
      const opcodes = extractOpcodesFromSb3(await file.arrayBuffer())
      const { ok, missing } = checkRequiredBlocks(opcodes, requiredBlocks)
      if (!ok) {
        return NextResponse.json(
          { error: '作品还差一点点', missing },
          { status: 422 }
        )
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
    }

    const { data, error } = await callRpc(supabaseAdmin, 'record_course_lesson_completion', {
      p_user_id: user.id,
      p_course_id: courseId,
      p_lesson_id: lessonId,
    })
    if (error) throw error

    const result = data as unknown as CompletionRpcResult
    if (result.course_completion_state === 'configuration_error') {
      logger.warn('Course milestone deferred because STEAM configuration is invalid', { courseId })
    }
    return NextResponse.json({
      progress: result.progress,
      alreadyCompleted: result.already_completed,
      courseProgress: {
        completedLessonCount: result.completed_lesson_count,
        totalLessonCount: result.total_lesson_count,
        status: result.status,
        nextLessonId: result.next_lesson_id,
        milestoneCompletedAt: result.milestone_completed_at,
      },
      courseCompletionCreated: result.course_completion_created,
      courseCompletionState: result.course_completion_state,
    })
  } catch (error) {
    logger.error('POST lesson complete failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}
