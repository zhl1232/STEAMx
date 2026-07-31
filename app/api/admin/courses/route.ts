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

    const steamWeights = validateCourseSteamWeights(
      body.steam_weights === undefined ? DEFAULT_COURSE_STEAM_WEIGHTS : body.steam_weights,
    )
    if (!steamWeights.valid || !steamWeights.value) {
      throw new ValidationError(steamWeights.error || 'Invalid steam_weights')
    }
    if (status === 'approved') {
      return NextResponse.json(
        { error: '请先创建课时，再发布课程' },
        { status: 400 },
      )
    }

    const insertData = {
      title,
      description,
      status: status ?? 'draft',
      difficulty_stars: difficultyStars,
      image_url: body.image_url || null,
      tags: body.tags || [],
      sort_order: body.sort_order ?? 0,
      steam_weights: steamWeights.value,
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
