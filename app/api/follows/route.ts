import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

type Action = 'follow' | 'unfollow'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-follows-write', limit: 60, windowMs: 60_000 })
    const body = await request.json()

    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : ''
    const action = typeof body?.action === 'string' ? (body.action as Action) : 'follow'

    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
    }
    if (action !== 'follow' && action !== 'unfollow') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (action === 'follow') {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: targetUserId,
        } as never)

      if (error && error.code !== '23505') {
        throw error
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)

      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
