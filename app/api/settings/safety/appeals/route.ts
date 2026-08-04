import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateNumber, validateRequiredString } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json().catch(() => ({}))
    const actionId = validateNumber(body?.actionId, 'actionId', { integer: true, min: 1 })
    const reason = validateRequiredString(body?.reason, 'reason', 2000)
    const now = new Date().toISOString()

    const { data: action, error: actionError } = await supabase
      .from('safety_actions')
      .select('id, user_id, status, starts_at, ends_at')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .maybeSingle()
    if (actionError) throw actionError
    if (!action) return NextResponse.json({ error: '处罚不存在、已失效或无法申诉' }, { status: 404 })

    const { data, error } = await supabase
      .from('safety_appeals')
      .insert({
        action_id: action.id,
        appellant_id: user.id,
        reason,
      })
      .select('id, action_id, status, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '该处罚已有待处理申诉' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ appeal: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
