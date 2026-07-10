import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { isValidLessonTypeSlug } from '@/lib/courses/lesson-types'
import { validateRequiredString, ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: idRaw } = await params
  const courseId = Number(idRaw)

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ error: 'Invalid course id' }, { status: 400 })
  }

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json()

    const title = validateRequiredString(body.title, 'Title', 200)
    const lessonType = body.lesson_type ?? 'scratch'
    if (!isValidLessonTypeSlug(lessonType)) {
      throw new ValidationError('lesson_type must be a valid lesson type slug')
    }

    const content = body.content && typeof body.content === 'object' ? body.content : {}
    const workSubmissionEnabled = typeof body.work_submission_enabled === 'boolean'
      ? body.work_submission_enabled
      : lessonType === 'scratch' || lessonType === 'building_3d'
    const insertData = {
      course_id: courseId,
      title,
      lesson_type: lessonType,
      content: { ...content, workSubmission: { enabled: workSubmissionEnabled } },
      steps: body.steps ?? [],
      resources: body.resources ?? [],
      starter_project_path: body.starter_project_path ?? null,
      sort_order: body.sort_order ?? 0,
      duration_minutes: body.duration_minutes ?? null,
    }

    const { data, error } = await supabase
      .from('course_lessons')
      .insert(insertData as never)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ lesson: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
