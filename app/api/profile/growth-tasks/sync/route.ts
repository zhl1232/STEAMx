import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import type { UserStats } from '@/lib/gamification/types'
import { logger } from '@/lib/logger'
import {
  GROWTH_TASK_GRADUATION_ACTION_TYPE,
  GROWTH_TASK_GRADUATION_RESOURCE_ID,
  GROWTH_TASK_REWARD_ACTION_TYPE,
  getCompletedGrowthTaskCount,
  type GrowthTaskId,
  isAllGrowthTasksClaimed,
  resolveGrowthTasks,
  toGrowthTaskInput,
} from '@/lib/profile/growth-tasks'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

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

    let claimedTaskIds = new Set<GrowthTaskId>()

    if (supabaseAdmin) {
      const { data: rewardRows, error: rewardError } = await supabaseAdmin
        .from('xp_logs')
        .select('resource_id')
        .eq('user_id', user.id)
        .eq('action_type', GROWTH_TASK_REWARD_ACTION_TYPE)

      if (rewardError) {
        throw rewardError
      }

      claimedTaskIds = new Set(
        ((rewardRows as { resource_id: string | null }[] | null) || [])
          .map((row) => row.resource_id)
          .filter((resourceId): resourceId is GrowthTaskId => !!resourceId),
      )
    }

    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: (profile as { bio?: string | null } | null)?.bio ?? '',
        stats: (statsData as Partial<UserStats> | null) ?? undefined,
      }),
      claimedTaskIds,
    )

    let graduatedAt: string | null = null

    if (supabaseAdmin) {
      const { data: graduationRow, error: graduationSelectError } = await supabaseAdmin
        .from('xp_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('action_type', GROWTH_TASK_GRADUATION_ACTION_TYPE)
        .eq('resource_id', GROWTH_TASK_GRADUATION_RESOURCE_ID)
        .maybeSingle()

      if (graduationSelectError) {
        throw graduationSelectError
      }

      graduatedAt = (graduationRow as { created_at?: string } | null)?.created_at ?? null

      if (isAllGrowthTasksClaimed(tasks) && !graduatedAt) {
        const { error: backfillError } = await supabaseAdmin.from('xp_logs').upsert(
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

        if (backfillError) {
          throw backfillError
        }

        const { data: afterBackfill, error: afterErr } = await supabaseAdmin
          .from('xp_logs')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('action_type', GROWTH_TASK_GRADUATION_ACTION_TYPE)
          .eq('resource_id', GROWTH_TASK_GRADUATION_RESOURCE_ID)
          .maybeSingle()

        if (afterErr) {
          throw afterErr
        }

        graduatedAt = (afterBackfill as { created_at?: string } | null)?.created_at ?? null
      }

      if (!isAllGrowthTasksClaimed(tasks) && graduatedAt) {
        logger.warn('Growth task graduation sentinel exists but not all tasks are claimed', {
          userId: user.id,
        })
      }
    }

    return NextResponse.json({
      tasks,
      completedTaskCount: getCompletedGrowthTaskCount(tasks),
      graduatedAt,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
