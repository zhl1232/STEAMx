import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/auth/ensure-profile'
import { requireRequestRateLimit } from '@/lib/api/auth-rate-limit'
import { handleApiError } from '@/lib/api/auth'

export async function POST(request: Request) {
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return NextResponse.json({ ok: false, created: false }, { status: 401 })
    requireRequestRateLimit(request, {
      key: 'profile-ensure', suffix: user.id, limit: 10, windowMs: 60_000,
    })
    const { ok, created } = await ensureProfile({ userId: user.id, userMetadata: user.user_metadata, phone: user.phone })
    return NextResponse.json({ ok, created })
  } catch (error) {
    return handleApiError(error)
  }
}
