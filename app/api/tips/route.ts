import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

const ALLOWED_TYPES = new Set(['project', 'completion'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-tips', limit: 10, windowMs: 60_000 })
    const body = await request.json()

    const resourceType = typeof body?.resourceType === 'string' ? body.resourceType : ''
    const resourceId = Number(body?.resourceId)
    const amount = Number(body?.amount)

    if (!ALLOWED_TYPES.has(resourceType) || Number.isNaN(resourceId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('tip_resource', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_amount: amount,
    } as never)

    if (error) throw error

    const result = data as { ok?: boolean; error?: string } | null
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error || 'tip_failed' })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
