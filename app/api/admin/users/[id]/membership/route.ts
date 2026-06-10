import { NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum } from '@/lib/api/validation'
import { membershipPeriods, type MembershipPeriod } from '@/lib/membership'
import { createClient } from '@/lib/supabase/server'

function normalizeMembershipUpdate(period: MembershipPeriod, expiresAt: unknown) {
  if (period === 'none') {
    return {
      membership_tier: 'free',
      membership_period: 'none',
      membership_started_at: null,
      membership_expires_at: null,
    }
  }

  const now = new Date().toISOString()

  if (period === 'founder') {
    return {
      membership_tier: 'founder',
      membership_period: 'founder',
      membership_started_at: now,
      membership_expires_at: null,
    }
  }

  if (period === 'lifetime') {
    return {
      membership_tier: 'pro',
      membership_period: 'lifetime',
      membership_started_at: now,
      membership_expires_at: null,
    }
  }

  const expiry = typeof expiresAt === 'string' ? expiresAt.trim() : ''
  const expiryTime = Date.parse(expiry)
  if (!expiry || Number.isNaN(expiryTime)) {
    return NextResponse.json({ error: '请选择有效的会员到期时间' }, { status: 400 })
  }

  if (expiryTime <= Date.now()) {
    return NextResponse.json({ error: '会员到期时间必须晚于当前时间' }, { status: 400 })
  }

  return {
    membership_tier: 'pro',
    membership_period: period,
    membership_started_at: now,
    membership_expires_at: new Date(expiryTime).toISOString(),
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
    const updateData = normalizeMembershipUpdate(period, body.expires_at)
    if (updateData instanceof NextResponse) return updateData

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select('id, membership_tier, membership_period, membership_started_at, membership_expires_at')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    return handleApiError(error)
  }
}
