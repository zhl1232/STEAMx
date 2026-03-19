import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum } from '@/lib/api/validation'

const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  timed: {
    draft: ['active'],
    active: ['ended'],
  },
  evergreen: {
    draft: ['active'],
    active: ['archived'],
  },
}

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

    const targetStatus = validateEnum(body.status, 'Status', ['active', 'ended', 'archived'] as const)

    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (fetchError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const ch = challenge as { challenge_type: string; status: string }
    const allowed = VALID_TRANSITIONS[ch.challenge_type]?.[ch.status] || []

    if (!allowed.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${ch.status} to ${targetStatus} for ${ch.challenge_type} challenge` },
        { status: 400 }
      )
    }

    // For timed challenges ending: trigger settlement via RPC
    if (ch.challenge_type === 'timed' && targetStatus === 'ended') {
      const { data: result, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string, args: unknown
      ) => PromiseLike<{ data: unknown; error: unknown }>)(
        'settle_timed_challenge',
        { p_challenge_id: challengeId }
      )

      if (rpcError) throw rpcError

      return NextResponse.json({
        message: 'Challenge ended and settled',
        status: 'ended',
        settlement: result,
      })
    }

    // Simple status transition
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ status: targetStatus } as never)
      .eq('id', challengeId)

    if (updateError) throw updateError

    return NextResponse.json({
      message: `Challenge status updated to ${targetStatus}`,
      status: targetStatus,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
