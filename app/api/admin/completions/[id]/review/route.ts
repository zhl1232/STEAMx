import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateOptionalString, validateNumber } from '@/lib/api/validation'
import { callRpc } from '@/lib/supabase/rpc'

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
    const completionId = validateNumber(id, 'Completion id', { min: 1, integer: true })

    const { data: existingCompletion, error: completionLookupError } = await supabase
      .from('completed_projects')
      .select('id')
      .eq('id', completionId)
      .maybeSingle()

    if (completionLookupError) {
      throw completionLookupError
    }

    if (!existingCompletion) {
      return NextResponse.json({ error: 'Completion not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const { data, error } = await callRpc(supabase, 'approve_completion_with_reward', {
        p_completion_id: completionId,
      })

      if (error) {
        throw error
      }

      const rewardResult = data as unknown as { xp_awarded?: boolean }

      return NextResponse.json({
        message: 'Completion approved successfully',
        status: 'approved',
        xpAwarded: rewardResult.xp_awarded === true,
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
