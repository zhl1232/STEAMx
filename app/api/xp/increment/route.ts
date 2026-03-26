import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-xp-increment', limit: 20, windowMs: 60_000 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const amount = Number((body as { amount?: unknown })?.amount)
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务暂时不可用' }, { status: 500 })
    }

    const { error } = await callRpc(supabaseAdmin, 'increment_user_xp', {
      p_user_id: user.id,
      p_amount: amount,
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
