import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { syncSafetyProjection } from '@/lib/safety/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { user } = await requireRole(supabase, ['moderator', 'admin'])
    const appealId = Number((await params).id)
    if (!Number.isInteger(appealId) || appealId < 1) {
      return NextResponse.json({ error: '申诉 ID 无效' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const status = validateEnum(body?.status, 'status', ['approved', 'rejected'] as const)
    const reviewerNote = validateOptionalString(body?.reviewer_note, 'reviewer_note', 1000)

    const { data: appeal, error: appealError } = await supabase
      .from('safety_appeals')
      .select('id, action_id, appellant_id, status')
      .eq('id', appealId)
      .maybeSingle()
    if (appealError) throw appealError
    if (!appeal || appeal.status !== 'pending') {
      return NextResponse.json({ error: '申诉不存在或已处理' }, { status: 404 })
    }

    const { data: updatedAppeal, error: updateError } = await supabase
      .from('safety_appeals')
      .update({
        status,
        reviewer_id: user.id,
        reviewer_note: reviewerNote || null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq('id', appealId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updatedAppeal) {
      return NextResponse.json({ error: '申诉不存在或已处理' }, { status: 409 })
    }

    if (status === 'approved') {
      const { error: revokeError } = await supabase
        .from('safety_actions')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        } as never)
        .eq('id', appeal.action_id)
      if (revokeError) throw revokeError
      await syncSafetyProjection(appeal.appellant_id)
    }

    return NextResponse.json({ appeal: { id: appealId, status } })
  } catch (error) {
    return handleApiError(error)
  }
}
