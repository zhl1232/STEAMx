import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import {
  validateRequiredString,
  validateOptionalString,
  validateEnum,
  validateNumber,
} from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

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

    if (body.title !== undefined) {
      updateData.title = validateRequiredString(body.title, 'Title', 200)
    }
    if (body.description !== undefined) {
      updateData.description = validateOptionalString(body.description, 'Description', 5000)
    }
    if (body.status !== undefined) {
      updateData.status = validateEnum(body.status, 'status', ['draft', 'approved', 'archived'] as const)
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
    if (body.steam_weights !== undefined) updateData.steam_weights = body.steam_weights

    const { data, error } = await supabase
      .from('courses')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

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

    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
