import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateDateTimeString, validateNumber, validateOptionalString } from '@/lib/api/validation'
import { validateChallengeResources } from '@/lib/api/challenge-resources'

function validateTimedChallengeWindow(startDate: unknown, endDate: unknown) {
  const start = validateDateTimeString(startDate, 'start_date')
  const end = validateDateTimeString(endDate, 'end_date')

  if (Date.parse(end) <= Date.parse(start)) {
    return NextResponse.json(
      { error: 'end_date must be later than start_date' },
      { status: 400 }
    )
  }

  return { start, end }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const challengeId = validateNumber(id, 'Challenge id', { min: 1, integer: true })
    const body = await request.json()
    const { data: existingChallenge, error: existingError } = await supabase
      .from('challenges')
      .select('id, challenge_type, start_date, end_date')
      .eq('id', challengeId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existingChallenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) updateData.title = validateOptionalString(body.title, 'Title', 200) || undefined
    if (body.description !== undefined) updateData.description = body.description
    if (body.image_url !== undefined) updateData.image_url = body.image_url
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.difficulty_stars !== undefined) {
      updateData.difficulty_stars = validateNumber(body.difficulty_stars, 'Difficulty stars', {
        min: 1,
        max: 6,
        integer: true,
      })
    }
    if (body.scenario !== undefined) updateData.scenario = body.scenario
    if (body.driving_question !== undefined) updateData.driving_question = body.driving_question
    if (body.expected_outcome !== undefined) updateData.expected_outcome = body.expected_outcome
    if (body.constraints !== undefined) updateData.constraints = body.constraints
    if (body.resources !== undefined) updateData.resources = validateChallengeResources(body.resources)
    if (body.stages !== undefined) updateData.stages = body.stages
    if (body.steam_weights !== undefined) updateData.steam_weights = body.steam_weights
    if ((existingChallenge as { challenge_type: string }).challenge_type === 'timed') {
      const nextStart = body.start_date !== undefined
        ? body.start_date
        : (existingChallenge as { start_date: string | null }).start_date
      const nextEnd = body.end_date !== undefined
        ? body.end_date
        : (existingChallenge as { end_date: string | null }).end_date
      const window = validateTimedChallengeWindow(nextStart, nextEnd)

      if (window instanceof NextResponse) {
        return window
      }

      if (body.start_date !== undefined) updateData.start_date = window.start
      if (body.end_date !== undefined) updateData.end_date = window.end
    } else {
      if (body.start_date !== undefined) updateData.start_date = null
      if (body.end_date !== undefined) updateData.end_date = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('challenges')
      .update(updateData as never)
      .eq('id', challengeId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    return NextResponse.json({ challenge: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const challengeId = validateNumber(id, 'Challenge id', { min: 1, integer: true })

    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('status')
      .eq('id', challengeId)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if ((challenge as { status: string }).status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft challenges can be deleted' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId)

    if (error) throw error

    return NextResponse.json({ message: 'Challenge deleted' })
  } catch (error) {
    return handleApiError(error)
  }
}
