import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const targetUserId = validateUUID(
      request.nextUrl.searchParams.get('targetUserId') || '',
      'targetUserId'
    )

    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ isFollowing: !!data })
  } catch (error) {
    return handleApiError(error)
  }
}
