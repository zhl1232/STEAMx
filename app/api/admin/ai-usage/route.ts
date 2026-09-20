import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AiUsageLog = {
  user_id: string
  amount: number
  reason: string
  meta: unknown
  created_at: string
}

type UsageTotals = Omit<DailyRow, 'day'>

type UsageSummary = {
  daily: DailyRow[]
  totals: UsageTotals
  users: Map<string, { chats: number; creditsUsedMilli: number }>
}

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

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function creditsUsedMilli(log: AiUsageLog): number | null {
  const meta = log.meta && typeof log.meta === 'object' ? log.meta as Record<string, unknown> : null
  if (meta?.billing === 'tutor_output_tokens') {
    if (meta.state !== 'settled' || !validNumber(meta.chargedCredits) || meta.chargedCredits < 0) return null
    return Math.round(meta.chargedCredits * 1000)
  }
  if (log.reason !== 'credit_chat' || !validNumber(log.amount)) return null
  return Math.round(Math.abs(log.amount) * 1000)
}

/** Summarize settled tutor receipts while retaining legacy credit_chat semantics. */
function summarizeAiUsage(logs: AiUsageLog[]): UsageSummary {
  const dailyMap = new Map<string, DailyRow>()
  const users = new Map<string, { chats: number; creditsUsedMilli: number }>()

  for (const log of logs) {
    const creditsMilli = creditsUsedMilli(log)
    const meta = log.meta && typeof log.meta === 'object' ? log.meta as Record<string, unknown> : null
    const isTutorReceipt = meta?.billing === 'tutor_output_tokens'
    const isFree = log.reason === 'free_chat' && (!isTutorReceipt || creditsMilli !== null)
    if (creditsMilli == null && !isFree) continue

    const day = log.created_at.slice(0, 10)
    const row = dailyMap.get(day) ?? { day, chats: 0, creditsUsed: 0, freeChats: 0, memberChats: 0 }
    row.chats += 1
    if (isFree) row.freeChats += 1
    else {
      row.memberChats += 1
      row.creditsUsed += (creditsMilli ?? 0) / 1000
    }
    dailyMap.set(day, row)

    const userStats = users.get(log.user_id) ?? { chats: 0, creditsUsedMilli: 0 }
    userStats.chats += 1
    if (!isFree) userStats.creditsUsedMilli += creditsMilli ?? 0
    users.set(log.user_id, userStats)
  }

  const daily = [...dailyMap.values()].map((row) => ({
    ...row,
    creditsUsed: Math.round(row.creditsUsed * 1000) / 1000,
  })).sort((a, b) => a.day.localeCompare(b.day))
  const totals = daily.reduce(
    (acc, row) => ({
      chats: acc.chats + row.chats,
      creditsUsed: Math.round(acc.creditsUsed * 1000 + Math.round(row.creditsUsed * 1000)) / 1000,
      freeChats: acc.freeChats + row.freeChats,
      memberChats: acc.memberChats + row.memberChats,
    }),
    { chats: 0, creditsUsed: 0, freeChats: 0, memberChats: 0 },
  )
  return { daily, totals, users }
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
      .select('user_id, amount, reason, meta, created_at')
      .gte('created_at', since.toISOString())
      .in('reason', ['credit_chat', 'free_chat'])
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    const summary = summarizeAiUsage((logs ?? []) as AiUsageLog[])
    const userMap = new Map([...summary.users].map(([userId, stats]) => [userId, {
      chats: stats.chats,
      creditsUsed: stats.creditsUsedMilli / 1000,
    }]))

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

    return NextResponse.json({ daily: summary.daily, totals: summary.totals, topUsers })
  } catch (error) {
    return handleApiError(error)
  }
}
