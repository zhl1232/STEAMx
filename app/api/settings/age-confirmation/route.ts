import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { data, error } = await supabase
      .from('profiles')
      .select('age_confirmed_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    const confirmedAt = (data as { age_confirmed_at?: string | null } | null)?.age_confirmed_at ?? null
    return NextResponse.json({ confirmed: Boolean(confirmedAt), confirmedAt })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST() {
  const supabase = await createClient()

  try {
    await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'settings-age-confirmation',
      limit: 5,
      windowMs: 60_000,
    })

    const { data, error } = await callRpc(supabase, 'confirm_my_age', {})
    if (error) throw error

    return NextResponse.json({
      confirmed: true,
      confirmedAt: data,
      method: 'self',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
