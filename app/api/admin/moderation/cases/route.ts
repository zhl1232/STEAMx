import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { applySafetyAction, setContentModerationState } from '@/lib/safety/server'

const STATUSES = ['pending', 'approved', 'rejected', 'hidden', 'all'] as const
const ACTIONS = ['approve', 'reject', 'hide', 'warning', 'restrict_24h', 'restrict_7d', 'restrict_30d', 'ban'] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const status = validateEnum(request.nextUrl.searchParams.get('status') || 'pending', 'status', STATUSES)
    let query = supabase
      .from('moderation_cases')
      .select('*, author:author_id(id, display_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)

    if (status !== 'all') query = query.eq('status', status)
    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ cases: data ?? [], total: count ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { user } = await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json().catch(() => ({}))
    const caseId = Number(body?.caseId)
    if (!Number.isInteger(caseId) || caseId < 1) {
      return NextResponse.json({ error: 'caseId 无效' }, { status: 400 })
    }
    const action = validateEnum(body?.action, 'action', ACTIONS)
    const note = validateOptionalString(body?.note, 'note', 1000)

    const { data: moderationCase, error: loadError } = await supabase
      .from('moderation_cases')
      .select('id, content_type, content_id, author_id, status')
      .eq('id', caseId)
      .maybeSingle()
    if (loadError) throw loadError
    if (!moderationCase) return NextResponse.json({ error: '审核案件不存在' }, { status: 404 })
    if (moderationCase.status !== 'pending') {
      return NextResponse.json({ error: '审核案件已处理' }, { status: 409 })
    }

    if (['approve', 'reject'].includes(action)) {
      await setContentModerationState(
        moderationCase.content_type,
        moderationCase.content_id,
        action === 'approve' ? 'approved' : 'rejected',
      )
    }
    if (action === 'hide') {
      await setContentModerationState(moderationCase.content_type, moderationCase.content_id, 'hidden')
    }

    const accountActions = new Set(['warning', 'restrict_24h', 'restrict_7d', 'restrict_30d', 'ban'])
    if (accountActions.has(action) && moderationCase.author_id) {
      const durationHours = action === 'restrict_24h'
        ? 24
        : action === 'restrict_7d'
          ? 24 * 7
          : action === 'restrict_30d'
            ? 24 * 30
            : undefined
      await applySafetyAction({
        userId: moderationCase.author_id,
        actionType: action === 'warning' ? 'warning' : action === 'ban' ? 'account_ban' : 'interaction_restriction',
        reason: note || '自动审核案件处理',
        createdBy: user.id,
        sourceCaseId: caseId,
        endsAt: durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null,
        metadata: { action },
      })
    }

    const finalStatus = action === 'approve' ? 'approved' : action === 'hide' ? 'hidden' : 'rejected'
    const { data, error } = await supabase
      .from('moderation_cases')
      .update({
        status: finalStatus,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', caseId)
      .eq('status', 'pending')
      .select('id, status, resolved_at')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '审核案件不存在或已处理' }, { status: 409 })
    }

    return NextResponse.json({ case: data })
  } catch (error) {
    return handleApiError(error)
  }
}
