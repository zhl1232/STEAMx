import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DailyRow = {
  day: string
  chats: number
  creditsUsed: number
  freeChats: number
  memberChats: number
}

type TopUserRow = {
  userId: string
  displayName: string
  chats: number
  creditsUsed: number
}

export async function GET() {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务不可用' }, { status: 500 })
    }

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data: logs, error } = await supabaseAdmin
      .from('ai_credit_logs')
      .select('user_id, amount, reason, created_at')
      .gte('created_at', since.toISOString())
      .in('reason', ['credit_chat', 'free_chat'])
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    const dailyMap = new Map<string, DailyRow>()
    const userMap = new Map<string, { chats: number; creditsUsed: number }>()

    for (const log of logs ?? []) {
      const day = log.created_at.slice(0, 10)
      const row = dailyMap.get(day) ?? {
        day,
        chats: 0,
        creditsUsed: 0,
        freeChats: 0,
        memberChats: 0,
      }
      row.chats += 1
      if (log.reason === 'free_chat') row.freeChats += 1
      if (log.reason === 'credit_chat') {
        row.memberChats += 1
        row.creditsUsed += Math.abs(log.amount)
      }
      dailyMap.set(day, row)

      const userStats = userMap.get(log.user_id) ?? { chats: 0, creditsUsed: 0 }
      userStats.chats += 1
      if (log.reason === 'credit_chat') userStats.creditsUsed += Math.abs(log.amount)
      userMap.set(log.user_id, userStats)
    }

    const topUserIds = [...userMap.entries()]
      .sort((a, b) => b[1].chats - a[1].chats)
      .slice(0, 10)
      .map(([id]) => id)

    let topUsers: TopUserRow[] = []
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, username')
        .in('id', topUserIds)

      topUsers = topUserIds.map((userId) => {
        const profile = profiles?.find((p) => p.id === userId)
        const stats = userMap.get(userId)!
        return {
          userId,
          displayName: profile?.display_name || profile?.username || userId.slice(0, 8),
          chats: stats.chats,
          creditsUsed: stats.creditsUsed,
        }
      })
    }

    const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day))
    const totals = daily.reduce(
      (acc, row) => ({
        chats: acc.chats + row.chats,
        creditsUsed: acc.creditsUsed + row.creditsUsed,
        freeChats: acc.freeChats + row.freeChats,
        memberChats: acc.memberChats + row.memberChats,
      }),
      { chats: 0, creditsUsed: 0, freeChats: 0, memberChats: 0 },
    )

    return NextResponse.json({ daily, totals, topUsers })
  } catch (error) {
    return handleApiError(error)
  }
}
