import { NextRequest, NextResponse } from 'next/server'

import { getLessonInCourse, getUserLessonProgress, upsertUserLessonProgress } from '@/lib/api/courses'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { extractOpcodesFromSb3, checkRequiredBlocks } from '@/lib/courses/scratch-validate'
import type { LessonRequiredBlock } from '@/lib/courses/types'
import { logger } from '@/lib/logger'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string }>
}

const LESSON_COMPLETE_XP = 15

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

    // 幂等：已完成过则直接返回，不再校验、不再加经验
    if (progress.completed_at) {
      return NextResponse.json({ progress, alreadyCompleted: true })
    }

    // 关键积木校验：仅当本课配置了 requiredBlocks 时启用
    const requiredBlocks = (ctx.lesson.content?.requiredBlocks ?? []) as LessonRequiredBlock[]
    if (requiredBlocks.length > 0) {
      if (!supabaseAdmin) {
        return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
      }
      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from('scratch-projects')
        .download(progress.scratch_project_path)
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

    const updated = await upsertUserLessonProgress(supabase, {
      userId: user.id,
      lessonId,
      completed: true,
    })

    // Award XP once — 先写 xp_logs 去重，仅当插入了新行才加经验（仿 lib/completions/approve.ts）
    if (supabaseAdmin) {
      const { data: inserted, error: xpLogError } = await supabaseAdmin
        .from('xp_logs')
        .upsert(
          {
            user_id: user.id,
            action_type: 'complete_lesson',
            resource_id: String(lessonId),
            xp_amount: LESSON_COMPLETE_XP,
          } as never,
          { onConflict: 'user_id,action_type,resource_id', ignoreDuplicates: true },
        )
        .select('id')

      if (xpLogError) {
        logger.warn('Lesson complete XP log failed', { xpLogError, lessonId })
      } else if (inserted && inserted.length > 0) {
        const { error: xpError } = await callRpc(supabaseAdmin, 'increment_user_xp', {
          p_user_id: user.id,
          p_amount: LESSON_COMPLETE_XP,
        })
        if (xpError) {
          logger.warn('Lesson complete XP failed', { xpError, lessonId })
        }
      }
    }

    return NextResponse.json({ progress: updated })
  } catch (error) {
    logger.error('POST lesson complete failed', { error, courseId, lessonId })
    return handleApiError(error)
  }
}
