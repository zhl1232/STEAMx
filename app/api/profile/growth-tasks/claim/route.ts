import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  getGrowthTaskDefinition,
  isGrowthTaskId,
} from '@/lib/profile/growth-tasks'
import { supabaseAdmin } from '@/lib/supabase/admin'
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

    const task = getGrowthTaskDefinition(rawTaskId)
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }
    const { data: result, error: claimError } = await supabaseAdmin.rpc('claim_platform_growth_task', {
      p_user_id: user.id,
      p_task_id: rawTaskId,
    })
    if (claimError) {
      if (/not complete/i.test(claimError.message || '')) {
        return NextResponse.json({ error: '任务尚未完成，暂不能领取' }, { status: 400 })
      }
      throw claimError
    }
    const row = (Array.isArray(result) ? result[0] : result) as { xp_granted?: number; already_claimed?: boolean; graduated?: boolean } | null
    if (!row) throw new Error('成长任务领取结果为空')

    return NextResponse.json({
      ok: true,
      alreadyClaimed: row.already_claimed === true,
      taskId: rawTaskId,
      taskLabel: task.label,
      xpGranted: Number(row.xp_granted ?? 0),
      graduated: row.graduated === true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
