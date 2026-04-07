import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

type FollowListType = 'followers' | 'following'

interface ProfileListRow {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  equipped_avatar_frame_id: string | null
  equipped_name_color_id: string | null
}

function parseFollowListType(value: string | null): FollowListType {
  if (value === 'followers' || value === 'following') {
    return value
  }

  throw new ValidationError('Invalid follow list type')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const type = parseFollowListType(request.nextUrl.searchParams.get('type'))
    const targetColumn = type === 'followers' ? 'follower_id' : 'following_id'
    const filterColumn = type === 'followers' ? 'following_id' : 'follower_id'

    const { data: relationRows, error: relationError } = await supabase
      .from('follows')
      .select(`${targetColumn}, created_at`)
      .eq(filterColumn, user.id)
      .order('created_at', { ascending: false })

    if (relationError) throw relationError

    const rows = ((relationRows as { created_at: string; follower_id?: string; following_id?: string }[] | null) || [])
    const profileIds = rows
      .map((row) => row[targetColumn as 'follower_id' | 'following_id'])
      .filter((value): value is string => Boolean(value))

    if (profileIds.length === 0) {
      return NextResponse.json({ profiles: [], total: 0 })
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, role, equipped_avatar_frame_id, equipped_name_color_id')
      .in('id', profileIds)

    if (profileError) throw profileError

    const profileMap = new Map(
      (((profileRows as ProfileListRow[] | null) || []).map((profile) => [profile.id, profile] as const)),
    )

    return NextResponse.json({
      profiles: profileIds
        .map((profileId) => profileMap.get(profileId))
        .filter((profile): profile is ProfileListRow => Boolean(profile)),
      total: profileIds.length,
    })
  } catch (error) {
    logger.error('Error in GET /api/profile/follows', { error })
    return handleApiError(error)
  }
}
