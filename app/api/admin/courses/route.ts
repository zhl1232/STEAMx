import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import {
  validateRequiredString,
  validateOptionalString,
  validateEnum,
  validateNumber,
} from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { data, error } = await supabase
      .from('courses')
      .select('*, course_lessons(count)')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ courses: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json()

    const title = validateRequiredString(body.title, 'Title', 200)
    const description = validateOptionalString(body.description, 'Description', 5000)
    const status =
      body.status !== undefined
        ? validateEnum(body.status, 'status', ['draft', 'approved', 'archived'] as const)
        : 'draft'
    const difficultyStars = body.difficulty_stars !== undefined
      ? validateNumber(body.difficulty_stars, 'difficulty_stars', { min: 1, max: 6, integer: true })
      : 1

    const insertData = {
      title,
      description,
      status: status ?? 'draft',
      difficulty_stars: difficultyStars,
      image_url: body.image_url || null,
      tags: body.tags || [],
      sort_order: body.sort_order ?? 0,
      steam_weights: body.steam_weights || { S: 5, T: 35, E: 5, A: 15, M: 15 },
    }

    const { data, error } = await supabase
      .from('courses')
      .insert(insertData as never)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ course: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
