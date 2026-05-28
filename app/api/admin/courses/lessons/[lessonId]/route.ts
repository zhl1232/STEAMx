import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateRequiredString, validateEnum } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

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
      updateData.lesson_type = validateEnum(body.lesson_type, 'lesson_type', [
        'scratch',
        'reading',
        'video',
        'quiz',
      ] as const)
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

    const { error } = await supabase.from('course_lessons').delete().eq('id', lessonId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
