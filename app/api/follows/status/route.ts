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

    // 也返回对方是否回关：私信的 followers_only 档位按互相关注判定，界面要能对上
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .or(`and(follower_id.eq.${user.id},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${user.id})`)

    if (error) throw error

    const rows = data ?? []
    const isFollowing = rows.some((row) => row.follower_id === user.id)
    const isFollowedBy = rows.some((row) => row.follower_id === targetUserId)

    return NextResponse.json({ isFollowing, isFollowedBy, isMutual: isFollowing && isFollowedBy })
  } catch (error) {
    return handleApiError(error)
  }
}
