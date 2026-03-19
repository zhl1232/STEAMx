import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateRequiredString, validateOptionalString, validateEnum, validateNumber } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type')

    let query = supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })

    if (typeFilter && (typeFilter === 'timed' || typeFilter === 'evergreen')) {
      query = query.eq('challenge_type', typeFilter)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ challenges: data })
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
    const challengeType = validateEnum(body.challenge_type, 'Challenge type', ['timed', 'evergreen'] as const)
    const difficultyStars = body.difficulty_stars ? validateNumber(body.difficulty_stars, 'Difficulty stars', { min: 1, max: 6, integer: true }) : 3

    const insertData: Record<string, unknown> = {
      title,
      description,
      challenge_type: challengeType,
      status: 'draft',
      difficulty_stars: difficultyStars,
      image_url: body.image_url || null,
      tags: body.tags || [],
      scenario: body.scenario || null,
      driving_question: body.driving_question || null,
      expected_outcome: body.expected_outcome || null,
      constraints: body.constraints || [],
      resources: body.resources || [],
      stages: body.stages || [],
      steam_weights: body.steam_weights || { S: 0, T: 0, E: 0, A: 0, M: 0 },
    }

    if (challengeType === 'timed') {
      insertData.start_date = body.start_date || null
      insertData.end_date = body.end_date || null
    }

    const { data, error } = await supabase
      .from('challenges')
      .insert(insertData as never)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ challenge: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
