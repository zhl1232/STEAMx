import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateRequiredString, validateEnum } from '@/lib/api/validation'
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
    const lessonType = validateEnum(body.lesson_type, 'lesson_type', [
      'scratch',
      'reading',
      'video',
      'quiz',
    ] as const)

    const insertData = {
      course_id: courseId,
      title,
      lesson_type: lessonType ?? 'scratch',
      content: body.content ?? {},
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
