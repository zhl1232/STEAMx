import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const [profileResult, actionsResult, reportsResult, appealsResult, blocksResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('safety_status, safety_restricted_until, safety_restriction_reason')
        .eq('id', user.id)
        .single(),
      supabase
        .from('safety_actions')
        .select('id, action_type, status, reason, starts_at, ends_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('reports')
        .select('id, content_type, content_id, reason, status, reviewer_note, created_at, reviewed_at')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('safety_appeals')
        .select('id, action_id, reason, status, reviewer_note, created_at, reviewed_at')
        .eq('appellant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('user_blocks')
        .select('blocked_user_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (profileResult.error) throw profileResult.error
    if (actionsResult.error) throw actionsResult.error
    if (reportsResult.error) throw reportsResult.error
    if (appealsResult.error) throw appealsResult.error
    if (blocksResult.error) throw blocksResult.error

    return NextResponse.json({
      profile: profileResult.data,
      actions: actionsResult.data ?? [],
      reports: reportsResult.data ?? [],
      appeals: appealsResult.data ?? [],
      blocks: blocksResult.data ?? [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
