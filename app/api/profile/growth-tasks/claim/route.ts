import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import type { UserStats } from '@/lib/gamification/types'
import {
  GROWTH_TASK_GRADUATION_ACTION_TYPE,
  GROWTH_TASK_GRADUATION_RESOURCE_ID,
  GROWTH_TASK_REWARD_ACTION_TYPE,
  GROWTH_TASK_TOTAL,
  type GrowthTaskId,
  countDistinctClaimedGrowthTaskRewards,
  getGrowthTaskDefinition,
  isGrowthTaskId,
  resolveGrowthTasks,
  toGrowthTaskInput,
} from '@/lib/profile/growth-tasks'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-growth-task-claim', limit: 20, windowMs: 60_000 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawTaskId = (body as { taskId?: unknown })?.taskId
    if (typeof rawTaskId !== 'string' || !isGrowthTaskId(rawTaskId)) {
      return NextResponse.json({ error: 'Invalid taskId' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务暂时不可用' }, { status: 500 })
    }

    const [{ data: profile, error: profileError }, { data: statsData, error: statsError }] = await Promise.all([
      supabase.from('profiles').select('bio').eq('id', user.id).maybeSingle(),
      callRpc(supabase, 'get_user_stats_summary', { target_user_id: user.id }),
    ])

    if (profileError) {
      throw profileError
    }
    if (statsError) {
      throw statsError
    }

    const { data: existingReward, error: rewardError } = await supabaseAdmin
      .from('xp_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('action_type', GROWTH_TASK_REWARD_ACTION_TYPE)
      .eq('resource_id', rawTaskId)
      .maybeSingle()

    if (rewardError) {
      throw rewardError
    }

    const claimedTaskIds = existingReward ? new Set<GrowthTaskId>([rawTaskId]) : new Set<GrowthTaskId>()
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: (profile as { bio?: string | null } | null)?.bio ?? '',
        stats: (statsData as Partial<UserStats> | null) ?? undefined,
      }),
      claimedTaskIds,
    )
    const task = tasks.find((item) => item.id === rawTaskId)

    if (!task || !getGrowthTaskDefinition(rawTaskId)) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }

    if (task.claimed) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        taskId: rawTaskId,
        xpGranted: 0,
        graduated: false,
      })
    }

    if (!task.claimable) {
      return NextResponse.json({ error: '任务尚未完成，暂不能领取' }, { status: 400 })
    }

    const { data: insertedReward, error: insertError } = await supabaseAdmin
      .from('xp_logs')
      .upsert(
        {
          user_id: user.id,
          action_type: GROWTH_TASK_REWARD_ACTION_TYPE,
          resource_id: rawTaskId,
          xp_amount: task.rewardXp,
        } as never,
        {
          onConflict: 'user_id,action_type,resource_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')

    if (insertError) {
      throw insertError
    }

    if (!insertedReward || insertedReward.length === 0) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        taskId: rawTaskId,
        xpGranted: 0,
        graduated: false,
      })
    }

    const { error: incrementError } = await callRpc(supabaseAdmin, 'increment_user_xp', {
      p_user_id: user.id,
      p_amount: task.rewardXp,
    })

    if (incrementError) {
      throw incrementError
    }

    let graduated = false
    const { data: rewardIdRows, error: rewardIdsError } = await supabaseAdmin
      .from('xp_logs')
      .select('resource_id')
      .eq('user_id', user.id)
      .eq('action_type', GROWTH_TASK_REWARD_ACTION_TYPE)

    if (rewardIdsError) {
      throw rewardIdsError
    }

    const claimedGrowthCount = countDistinctClaimedGrowthTaskRewards((rewardIdRows as { resource_id: string | null }[]) || [])
    if (claimedGrowthCount >= GROWTH_TASK_TOTAL) {
      const { data: insertedGraduation, error: graduationError } = await supabaseAdmin
        .from('xp_logs')
        .upsert(
          {
            user_id: user.id,
            action_type: GROWTH_TASK_GRADUATION_ACTION_TYPE,
            resource_id: GROWTH_TASK_GRADUATION_RESOURCE_ID,
            xp_amount: 0,
          } as never,
          {
            onConflict: 'user_id,action_type,resource_id',
            ignoreDuplicates: true,
          },
        )
        .select('id')

      if (graduationError) {
        throw graduationError
      }

      graduated = !!(insertedGraduation && insertedGraduation.length > 0)
    }

    return NextResponse.json({
      ok: true,
      alreadyClaimed: false,
      taskId: rawTaskId,
      taskLabel: task.label,
      xpGranted: task.rewardXp,
      graduated,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
