import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUUID } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const targetUserId = request.nextUrl.searchParams.get('userId')
    if (targetUserId) {
      const targetId = validateUUID(targetUserId, 'userId')
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_user_id')
        .or(
          `and(blocker_id.eq.${user.id},blocked_user_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_user_id.eq.${user.id})`,
        )
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return NextResponse.json({
        blocked: Boolean(data),
        blockedByMe: data?.blocker_id === user.id,
        userId: targetId,
      })
    }

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_user_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const ids = (data ?? []).map((row) => row.blocked_user_id)
    if (ids.length === 0) return NextResponse.json({ blocks: [] })

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)

    if (profileError) throw profileError
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

    return NextResponse.json({
      blocks: (data ?? []).map((row) => ({
        userId: row.blocked_user_id,
        createdAt: row.created_at,
        profile: profileMap.get(row.blocked_user_id) ?? null,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-blocks', limit: 20, windowMs: 60_000 })
    const body = await request.json().catch(() => ({}))
    const blockedUserId = validateUUID(body?.blockedUserId, 'blockedUserId')

    if (blockedUserId === user.id) {
      return NextResponse.json({ error: '不能屏蔽自己' }, { status: 400 })
    }

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', blockedUserId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    const { error } = await supabase.from('user_blocks').upsert({
      blocker_id: user.id,
      blocked_user_id: blockedUserId,
    }, { onConflict: 'blocker_id,blocked_user_id', ignoreDuplicates: true })
    if (error) throw error

    // A block also removes both follow directions when the server-side admin
    // client is available. The owner-side delete remains safe as a fallback.
    const cleanupClient = supabaseAdmin ?? supabase
    const { error: followError } = await cleanupClient
      .from('follows')
      .delete()
      .or(`and(follower_id.eq.${user.id},following_id.eq.${blockedUserId}),and(follower_id.eq.${blockedUserId},following_id.eq.${user.id})`)
    if (followError) throw followError

    return NextResponse.json({ blocked: true, userId: blockedUserId })
  } catch (error) {
    return handleApiError(error)
  }
}
