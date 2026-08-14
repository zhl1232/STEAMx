import { NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum } from '@/lib/api/validation'
import { membershipPeriods } from '@/lib/membership'
import { createClient } from '@/lib/supabase/server'

type MembershipRpcResult = {
  ok?: boolean
  error?: string
  user?: {
    id: string
    membership_tier: string
    membership_period: string
    membership_started_at: string | null
    membership_expires_at: string | null
  }
}

function membershipRpcErrorResponse(code: string | undefined) {
  switch (code) {
    case 'not_found':
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    case 'invalid_expiry':
      return NextResponse.json({ error: '请选择有效的会员到期时间' }, { status: 400 })
    case 'expiry_in_past':
      return NextResponse.json({ error: '会员到期时间必须晚于当前时间' }, { status: 400 })
    case 'invalid_period':
    case 'invalid_params':
      return NextResponse.json({ error: 'Invalid membership period' }, { status: 400 })
    case 'unauthorized':
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    case 'forbidden':
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    default:
      return NextResponse.json({ error: '调整失败' }, { status: 400 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])

    const { id } = await params
    const userId = typeof id === 'string' ? id.trim() : ''
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const body = await request.json()
    const period = validateEnum(body.period, 'Membership period', membershipPeriods)
    const expiresAt = typeof body.expires_at === 'string' ? body.expires_at.trim() : ''

    const { data, error } = await supabase.rpc('admin_set_membership', {
      p_target_user_id: userId,
      p_period: period,
      p_expires_at: expiresAt || null,
    })

    if (error) throw error
    const result = (data ?? null) as MembershipRpcResult | null
    if (!result?.ok || !result.user) {
      return membershipRpcErrorResponse(result?.error)
    }

    return NextResponse.json({ user: result.user })
  } catch (error) {
    return handleApiError(error)
  }
}
