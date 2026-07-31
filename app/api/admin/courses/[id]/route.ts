import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import {
  validateRequiredString,
  validateOptionalString,
  validateEnum,
  validateNumber,
  ValidationError,
} from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_COURSE_STEAM_WEIGHTS,
  validateCourseSteamWeights,
} from '@/lib/courses/config'
import { triggerCourseCompletionReconcile } from '@/lib/courses/reconcile'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: idRaw } = await params
  const id = Number(idRaw)

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    const shouldReconcile =
      body.status === 'approved' ||
      body.difficulty_stars !== undefined ||
      body.steam_weights !== undefined

    if (body.title !== undefined) {
      updateData.title = validateRequiredString(body.title, 'Title', 200)
    }
    if (body.description !== undefined) {
      updateData.description = validateOptionalString(body.description, 'Description', 5000)
    }
    if (body.status !== undefined) {
      updateData.status = validateEnum(body.status, 'status', ['draft', 'approved', 'archived'] as const)
      if (updateData.status === 'approved') {
        const { count, error: lessonCountError } = await supabase
          .from('course_lessons')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', id)
        if (lessonCountError) throw lessonCountError
        if ((count ?? 0) < 1) {
          throw new ValidationError('课程至少需要 1 个课时才能发布')
        }
      }
    }
    if (body.difficulty_stars !== undefined) {
      updateData.difficulty_stars = validateNumber(body.difficulty_stars, 'difficulty_stars', {
        min: 1,
        max: 6,
        integer: true,
      })
    }
    if (body.image_url !== undefined) updateData.image_url = body.image_url
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.steam_weights !== undefined) {
      const steamWeights = validateCourseSteamWeights(body.steam_weights)
      if (!steamWeights.valid || !steamWeights.value) {
        throw new ValidationError(steamWeights.error || 'Invalid steam_weights')
      }
      updateData.steam_weights = steamWeights.value
    }

    if (
      body.status === 'approved' ||
      body.difficulty_stars !== undefined ||
      body.steam_weights !== undefined
    ) {
      const { data: existingCourse, error: existingCourseError } = await supabase
        .from('courses')
        .select('difficulty_stars, steam_weights')
        .eq('id', id)
        .maybeSingle()
      if (existingCourseError) throw existingCourseError

      const effectiveWeights =
        (updateData.steam_weights as Record<string, unknown> | undefined) ??
        (existingCourse as { steam_weights?: unknown } | null)?.steam_weights ??
        DEFAULT_COURSE_STEAM_WEIGHTS
      const effectiveDifficulty =
        (updateData.difficulty_stars as number | undefined) ??
        (existingCourse as { difficulty_stars?: number } | null)?.difficulty_stars ??
        1
      const steamWeights = validateCourseSteamWeights(effectiveWeights)
      if (!steamWeights.valid || !steamWeights.value) {
        throw new ValidationError(steamWeights.error || 'Invalid steam_weights')
      }

      updateData.steam_weights = steamWeights.value
      updateData.difficulty_stars = validateNumber(effectiveDifficulty, 'difficulty_stars', {
        min: 1,
        max: 6,
        integer: true,
      })
    }

    const { data, error } = await supabase
      .from('courses')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (shouldReconcile) {
      await triggerCourseCompletionReconcile(id)
    }

    return NextResponse.json({ course: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: idRaw } = await params
  const id = Number(idRaw)

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { data: lessons, error: lessonError } = await supabase
      .from('course_lessons')
      .select('id')
      .eq('course_id', id)
    if (lessonError) throw lessonError
    const lessonIds = ((lessons || []) as { id: number }[]).map((lesson) => lesson.id)
    if (lessonIds.length > 0) {
      const { count, error: workError } = await supabase
        .from('completed_projects')
        .select('id', { count: 'exact', head: true })
        .in('course_lesson_id', lessonIds)
      if (workError) throw workError
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: '课程已有学员作品，请改为归档，不能直接删除' },
          { status: 409 },
        )
      }
    }

    const { count: milestoneCount, error: milestoneError } = await supabase
      .from('user_course_completions')
      .select('course_id', { count: 'exact', head: true })
      .eq('course_id', id)
    if (milestoneError) throw milestoneError
    if ((milestoneCount ?? 0) > 0) {
      return NextResponse.json(
        { error: '课程已有能力里程碑，请改为归档，不能直接删除' },
        { status: 409 },
      )
    }

    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
