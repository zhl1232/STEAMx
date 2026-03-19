import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { callRpc } from '@/lib/supabase/rpc'

type Action = 'join' | 'leave'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-challenges-participation', limit: 30, windowMs: 60_000 })

    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action === 'leave' ? 'leave' : 'join' as Action

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, status')
      .eq('id', challengeId)
      .maybeSingle()

    if (challengeError) throw challengeError
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const typedChallenge = challenge as { status: string }
    if (typedChallenge.status !== 'active') {
      return NextResponse.json({ error: 'Only active challenges can be joined or left' }, { status: 400 })
    }

    if (action === 'join') {
      const { data: insertedRows, error: insertError } = await supabase
        .from('challenge_participants')
        .insert({ user_id: user.id, challenge_id: challengeId } as never)
        .select('challenge_id')

      if (insertError) {
        if ((insertError as { code?: string }).code === '23505') {
          return NextResponse.json({ joined: true, action: 'joined', changed: false })
        }
        throw insertError
      }

      if (insertedRows && insertedRows.length > 0) {
        const { error: rpcError } = await callRpc(supabase, 'increment_challenge_participants', {
          challenge_id: challengeId,
        })
        if (rpcError) throw rpcError
      }

      return NextResponse.json({ joined: true, action: 'joined', changed: Boolean(insertedRows?.length) })
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('challenge_participants')
      .delete()
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .select('challenge_id')

    if (deleteError) throw deleteError

    if (deletedRows && deletedRows.length > 0) {
      const { error: rpcError } = await callRpc(supabase, 'decrement_challenge_participants', {
        challenge_id: challengeId,
      })
      if (rpcError) throw rpcError
    }

    return NextResponse.json({ joined: false, action: 'left', changed: Boolean(deletedRows?.length) })
  } catch (error) {
    return handleApiError(error)
  }
}
