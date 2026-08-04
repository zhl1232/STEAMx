import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateEnum } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

const STATUSES = ['pending', 'approved', 'rejected', 'all'] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const status = validateEnum(
      request.nextUrl.searchParams.get('status') || 'pending',
      'status',
      STATUSES,
    )

    let query = supabase
      .from('safety_appeals')
      .select(`
        *,
        appellant:appellant_id(id, display_name, avatar_url),
        action:safety_actions(id, user_id, action_type, reason, status, starts_at, ends_at)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ appeals: data ?? [], total: count ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
