import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonthStartISO, getWeekStartISO } from '@/lib/date-utils'

type LeaderboardType = 'xp' | 'badges' | 'projects'
type XpTimeRange = 'weekly' | 'monthly' | 'alltime'

type LeaderboardUser = {
  id: string
  name: string
  xp: number
  level: number
  value: number
  avatar: string | null | undefined
  avatarFrameId?: string | null
  nameColorId?: string | null
  isCurrentUser?: boolean
}

const DEFAULT_LIMIT = 20

function parseLeaderboardType(value: string | null): LeaderboardType {
  if (value === 'badges' || value === 'projects' || value === 'xp') return value
  return 'xp'
}

function parseXpRange(value: string | null): XpTimeRange {
  if (value === 'weekly' || value === 'monthly' || value === 'alltime') return value
  return 'alltime'
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(50, parsed))
}

function computeLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams

  const type = parseLeaderboardType(searchParams.get('type'))
  const range = parseXpRange(searchParams.get('range'))
  const limit = clampLimit(searchParams.get('limit'))

  try {
    let users: LeaderboardUser[] = []

    if (type === 'xp') {
      if (range === 'weekly') {
        const { data, error } = await supabase.rpc('get_leaderboard_xp_weekly', { limit_count: limit } as never)
        if (error) throw error
        const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number }[]) || []
        users = rows.map((row) => ({
          id: row.id,
          name: row.display_name || '匿名用户',
          xp: Number(row.xp) || 0,
          level: computeLevel(Number(row.xp) || 0),
          value: Number(row.xp) || 0,
          avatar: row.avatar_url,
        }))
      } else if (range === 'monthly') {
        const { data, error } = await supabase.rpc('get_leaderboard_xp_monthly', { limit_count: limit } as never)
        if (error) throw error
        const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number }[]) || []
        users = rows.map((row) => ({
          id: row.id,
          name: row.display_name || '匿名用户',
          xp: Number(row.xp) || 0,
          level: computeLevel(Number(row.xp) || 0),
          value: Number(row.xp) || 0,
          avatar: row.avatar_url,
        }))
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, xp, equipped_avatar_frame_id, equipped_name_color_id')
          .order('xp', { ascending: false })
          .limit(limit)
        if (error) throw error
        const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number | null; equipped_avatar_frame_id?: string | null; equipped_name_color_id?: string | null }[]) || []
        users = rows.map((row) => ({
          id: row.id,
          name: row.display_name || '匿名用户',
          xp: row.xp || 0,
          level: computeLevel(row.xp || 0),
          value: row.xp || 0,
          avatar: row.avatar_url,
          avatarFrameId: row.equipped_avatar_frame_id ?? undefined,
          nameColorId: row.equipped_name_color_id ?? undefined,
        }))
      }
    } else if (type === 'badges') {
      const { data, error } = await supabase.rpc('get_badge_leaderboard', { limit_count: limit } as never)
      if (error) throw error
      const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number; badge_count: number }[]) || []
      users = rows.map((row) => ({
        id: row.id,
        name: row.display_name || '匿名用户',
        xp: row.xp || 0,
        level: computeLevel(row.xp || 0),
        value: Number(row.badge_count || 0),
        avatar: row.avatar_url,
      }))
    } else {
      const { data, error } = await supabase.rpc('get_project_leaderboard', { limit_count: limit } as never)
      if (error) throw error
      const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number; project_count: number }[]) || []
      users = rows.map((row) => ({
        id: row.id,
        name: row.display_name || '匿名用户',
        xp: row.xp || 0,
        level: computeLevel(row.xp || 0),
        value: Number(row.project_count || 0),
        avatar: row.avatar_url,
      }))
    }

    const ids = users.map((user) => user.id)
    if (ids.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, equipped_avatar_frame_id, equipped_name_color_id')
        .in('id', ids)
      const profileMap = new Map(
        ((profileRows as { id: string; equipped_avatar_frame_id: string | null; equipped_name_color_id?: string | null }[]) || [])
          .map((row) => [row.id, row])
      )
      users = users.map((user) => {
        const profile = profileMap.get(user.id)
        if (!profile) return user
        return {
          ...user,
          avatarFrameId: user.avatarFrameId ?? profile.equipped_avatar_frame_id ?? undefined,
          nameColorId: user.nameColorId ?? profile.equipped_name_color_id ?? undefined,
        }
      })
    }

    if (type === 'xp') {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user && !users.some((u) => u.id === user.id)) {
        let myValue = 0
        if (range === 'weekly' || range === 'monthly') {
          const since = range === 'weekly' ? getWeekStartISO() : getMonthStartISO()
          const { data: myLogs } = await supabase
            .from('xp_logs')
            .select('xp_amount')
            .eq('user_id', user.id)
            .gte('created_at', since)
          myValue = (myLogs as { xp_amount: number }[] || []).reduce((sum, row) => sum + (row.xp_amount || 0), 0)
        } else {
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('xp, display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id')
            .eq('id', user.id)
            .single()
          const profile = myProfile as { xp?: number | null; display_name?: string | null; avatar_url?: string | null; equipped_avatar_frame_id?: string | null; equipped_name_color_id?: string | null } | null
          myValue = profile?.xp || 0
          users.push({
            id: user.id,
            name: profile?.display_name || '我',
            xp: myValue,
            level: computeLevel(myValue),
            value: myValue,
            avatar: profile?.avatar_url || null,
            avatarFrameId: profile?.equipped_avatar_frame_id ?? undefined,
            nameColorId: profile?.equipped_name_color_id ?? undefined,
            isCurrentUser: true,
          })
          users.sort((a, b) => b.value - a.value)
          return NextResponse.json({ users })
        }

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id')
          .eq('id', user.id)
          .single()
        const profile = myProfile as { display_name?: string | null; avatar_url?: string | null; equipped_avatar_frame_id?: string | null; equipped_name_color_id?: string | null } | null
        users.push({
          id: user.id,
          name: profile?.display_name || '我',
          xp: myValue,
          level: computeLevel(myValue),
          value: myValue,
          avatar: profile?.avatar_url || null,
          avatarFrameId: profile?.equipped_avatar_frame_id ?? undefined,
          nameColorId: profile?.equipped_name_color_id ?? undefined,
          isCurrentUser: true,
        })
        users.sort((a, b) => b.value - a.value)
      }
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error in GET /api/leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
