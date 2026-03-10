import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const targetUserId = request.nextUrl.searchParams.get('targetUserId') || ''
    if (!targetUserId) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ isFollowing: !!data })
  } catch (error) {
    return handleApiError(error)
  }
}
