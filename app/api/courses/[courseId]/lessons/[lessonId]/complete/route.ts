import { NextRequest, NextResponse } from 'next/server'

import { getLessonInCourse, getUserLessonProgress, upsertUserLessonProgress } from '@/lib/api/courses'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { logger } from '@/lib/logger'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { courseId: courseIdRaw, lessonId: lessonIdRaw } = await params
  const courseId = Number(courseIdRaw)
  const lessonId = Number(lessonIdRaw)

  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const user = await requireAuth(supabase)
    const ctx = await getLessonInCourse(supabase, courseId, lessonId)
    if (!ctx) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const progress = await getUserLessonProgress(supabase, user.id, lessonId)
    if (!progress?.scratch_project_path) {
      return NextResponse.json(
        { error: '请先保存 Scratch 作品再标记完成' },
        { status: 400 }
      )
    }

    const updated = await upsertUserLessonProgress(supabase, {
      userId: user.id,
      lessonId,
      completed: true,
    })

    // Award XP for lesson completion
    if (supabaseAdmin) {
      const { error: xpError } = await callRpc(supabaseAdmin, 'increment_user_xp', {
        p_user_id: user.id,
        p_amount: 15,
      })
      if (xpError) {
        logger.warn('Lesson complete XP failed', { xpError, lessonId })
      }
    }

    return NextResponse.json({ progress: updated })
  } catch (error) {
    logger.error('POST lesson complete failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}
