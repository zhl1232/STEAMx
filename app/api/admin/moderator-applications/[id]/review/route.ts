import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateNumber, validateOptionalString } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

const ACTIONS = ['approve', 'reject'] as const

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return null
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return null
}

/**
 * POST /api/admin/moderator-applications/[id]/review
 * 审核审核员申请（批准或拒绝）
 * 仅管理员可用
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])

    const body = await request.json()
    const action = validateEnum(body?.action, 'Action', ACTIONS)
    const rejectionReason = validateOptionalString(
      body?.rejection_reason,
      'Rejection reason',
      500
    )

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting an application' },
        { status: 400 }
      )
    }

    const { id } = await params
    const applicationId = validateNumber(id, 'Application id', { min: 1, integer: true })

    const { data: existingApplication, error: lookupError } = await supabase
      .from('moderator_applications')
      .select('id')
      .eq('id', applicationId)
      .eq('status', 'pending')
      .maybeSingle()

    if (lookupError) {
      throw lookupError
    }

    if (!existingApplication) {
      return NextResponse.json({ error: '申请不存在或已处理' }, { status: 404 })
    }

    const { data, error } = await callRpc(supabase, 'review_moderator_application', {
      p_application_id: applicationId,
      p_action: action,
      p_rejection_reason: rejectionReason ?? null,
    })

    if (error) {
      if (getErrorCode(error) === 'P0002') {
        return NextResponse.json({ error: '申请不存在或已处理' }, { status: 404 })
      }

      if (getErrorCode(error) === 'P0001') {
        return NextResponse.json(
          { error: getErrorMessage(error) || '申请状态冲突，请刷新后重试' },
          { status: 409 }
        )
      }

      throw error
    }

    const application = Array.isArray(data) ? data[0] ?? null : null

    return NextResponse.json({ application })
  } catch (error) {
    return handleApiError(error)
  }
}
