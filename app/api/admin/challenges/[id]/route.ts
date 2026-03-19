import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateOptionalString } from '@/lib/api/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const challengeId = parseInt(id)
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) updateData.title = validateOptionalString(body.title, 'Title', 200) || undefined
    if (body.description !== undefined) updateData.description = body.description
    if (body.image_url !== undefined) updateData.image_url = body.image_url
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.difficulty_stars !== undefined) updateData.difficulty_stars = body.difficulty_stars
    if (body.scenario !== undefined) updateData.scenario = body.scenario
    if (body.driving_question !== undefined) updateData.driving_question = body.driving_question
    if (body.expected_outcome !== undefined) updateData.expected_outcome = body.expected_outcome
    if (body.constraints !== undefined) updateData.constraints = body.constraints
    if (body.resources !== undefined) updateData.resources = body.resources
    if (body.stages !== undefined) updateData.stages = body.stages
    if (body.steam_weights !== undefined) updateData.steam_weights = body.steam_weights
    if (body.start_date !== undefined) updateData.start_date = body.start_date
    if (body.end_date !== undefined) updateData.end_date = body.end_date

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('challenges')
      .update(updateData as never)
      .eq('id', challengeId)
      .select()
      .single()

    if (error) throw error

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
    const challengeId = parseInt(id)

    const { data: challenge } = await supabase
      .from('challenges')
      .select('status')
      .eq('id', challengeId)
      .single()

    if (challenge && (challenge as { status: string }).status !== 'draft') {
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
