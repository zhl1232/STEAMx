import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'
import { callRpc } from '@/lib/supabase/rpc'
import { logger } from '@/lib/logger'

const COMPLETION_XP = 20

/**
 * POST /api/admin/completions/[id]/review
 * 审核完成作品（批准或拒绝）
 * 需要审核员或管理员权限
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const body = await request.json()

    const action = validateEnum(body.action, 'Action', ['approve', 'reject'] as const)
    const rejection_reason = validateOptionalString(body.rejection_reason, 'Rejection reason', 500)

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a completion' },
        { status: 400 }
      )
    }

    const { id } = await params
    const completionId = parseInt(id)

    if (isNaN(completionId)) {
      return NextResponse.json({ error: 'Invalid completion ID' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await callRpc(supabase, 'approve_completion', {
        completion_id: completionId
      })

      if (error) {
        throw error
      }

      // Award XP to the completion author
      await awardCompletionXp(completionId)

      return NextResponse.json({
        message: 'Completion approved successfully',
        status: 'approved'
      })
    } else {
      const { error } = await callRpc(supabase, 'reject_completion', {
        completion_id: completionId,
        reason: rejection_reason || ''
      })

      if (error) {
        throw error
      }

      return NextResponse.json({
        message: 'Completion rejected',
        status: 'rejected'
      })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

async function awardCompletionXp(completionId: number) {
  if (!supabaseAdmin) {
    logger.error('supabaseAdmin not configured, cannot award XP')
    return
  }

  const { data: completion } = await supabaseAdmin
    .from('completed_projects')
    .select('user_id, project_id')
    .eq('id', completionId)
    .single()

  if (!completion) return

  const comp = completion as { user_id: string; project_id: number }

  // Insert XP log with ON CONFLICT DO NOTHING (unique index prevents duplicates)
  const { data: inserted, error: xpLogError } = await supabaseAdmin
    .from('xp_logs')
    .upsert({
      user_id: comp.user_id,
      action_type: 'complete_project',
      resource_id: String(comp.project_id),
      xp_amount: COMPLETION_XP,
    } as never, { onConflict: 'user_id,action_type,resource_id', ignoreDuplicates: true })
    .select('id')

  if (xpLogError) {
    throw xpLogError
  }

  if (!inserted || inserted.length === 0) {
    logger.info('XP already awarded, skipping', { completionId })
    return
  }

  // Increment user XP atomically
  const { error: incrementError } = await callRpc(supabaseAdmin, 'increment_user_xp', {
    p_user_id: comp.user_id,
    p_amount: COMPLETION_XP,
  })

  if (incrementError) {
    throw incrementError
  }
}
