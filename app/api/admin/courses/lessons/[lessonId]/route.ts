import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { isValidLessonTypeSlug } from '@/lib/courses/lesson-types'
import { validateRequiredString, ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { triggerCourseCompletionReconcile } from '@/lib/courses/reconcile'

type RouteParams = { params: Promise<{ lessonId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { lessonId: lessonIdRaw } = await params
  const lessonId = Number(lessonIdRaw)

  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 })
  }

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      updateData.title = validateRequiredString(body.title, 'Title', 200)
    }
    if (body.lesson_type !== undefined) {
      if (!isValidLessonTypeSlug(body.lesson_type)) {
        throw new ValidationError('lesson_type must be a valid lesson type slug')
      }
      updateData.lesson_type = body.lesson_type
    }
    if (body.content !== undefined) updateData.content = body.content
    if (body.steps !== undefined) updateData.steps = body.steps
    if (body.resources !== undefined) updateData.resources = body.resources
    if (body.starter_project_path !== undefined) {
      updateData.starter_project_path = body.starter_project_path
    }
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes

    const { data, error } = await supabase
      .from('course_lessons')
      .update(updateData as never)
      .eq('id', lessonId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ lesson: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { lessonId: lessonIdRaw } = await params
  const lessonId = Number(lessonIdRaw)

  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 })
  }

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { data: lesson, error: lessonLookupError } = await supabase
      .from('course_lessons')
      .select('course_id')
      .eq('id', lessonId)
      .maybeSingle()
    if (lessonLookupError) throw lessonLookupError
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const { error } = await supabase.from('course_lessons').delete().eq('id', lessonId)
    if (error) throw error

    await triggerCourseCompletionReconcile(Number((lesson as { course_id: number }).course_id))

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
