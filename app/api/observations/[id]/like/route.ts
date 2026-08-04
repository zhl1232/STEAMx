import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: '无效的观察记录 ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('observation_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('observation_event_id', observationId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ liked: Boolean(data) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'engage')
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: '无效的观察记录 ID' }, { status: 400 })
    }

    const { data: observation } = await supabase
      .from('observation_events')
      .select('id')
      .eq('id', observationId)
      .eq('status', 'approved')
      .eq('is_public', true)
      .eq('moderation_state', 'approved')
      .maybeSingle()

    if (!observation) {
      return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('observation_likes')
      .insert({ user_id: user.id, observation_event_id: observationId })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ liked: true })
      }
      throw error
    }

    await supabase.rpc('increment_observation_likes', { target_observation_id: observationId })

    return NextResponse.json({ liked: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'engage')
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: '无效的观察记录 ID' }, { status: 400 })
    }

    const { error, count } = await supabase
      .from('observation_likes')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('observation_event_id', observationId)

    if (error) throw error

    if ((count ?? 0) > 0) {
      await supabase.rpc('decrement_observation_likes', { target_observation_id: observationId })
    }

    return NextResponse.json({ liked: false })
  } catch (error) {
    return handleApiError(error)
  }
}
