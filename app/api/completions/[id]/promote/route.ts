import { NextRequest, NextResponse } from 'next/server'

import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

type PromoteResult = {
  completion_id?: number
  status?: string
  record_kind?: string
  xp_awarded?: boolean
  already_final?: boolean
}

function databaseErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; constraint?: unknown }
  return [candidate.message, candidate.details, candidate.hint, candidate.constraint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
}

function isFinalConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown }
  const message = databaseErrorMessage(error)
  return message.includes('FINAL_ALREADY_EXISTS') || candidate.code === '23505'
}

/** POST /api/completions/[id]/promote — 将本人已审核的探索记录设为完成作品。 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'submit')
    const completionId = validateNumber((await params).id, 'Completion id', {
      min: 1,
      integer: true,
    })

    const { data, error } = await callRpc(supabase, 'promote_progress_completion_to_final', {
      p_completion_id: completionId,
    })

    if (error) {
      const message = databaseErrorMessage(error)
      if (message.includes('COMPLETION_NOT_FOUND')) {
        return NextResponse.json({ error: '没有找到这条探索记录' }, { status: 404 })
      }
      if (isFinalConflict(error)) {
        return NextResponse.json({ error: '这个项目已经有完成作品了' }, { status: 409 })
      }
      if (message.includes('COMPLETION_NOT_APPROVED')) {
        return NextResponse.json({ error: '记录审核通过后才能设为完成作品' }, { status: 409 })
      }
      if (message.includes('PROJECT_PROGRESS_REQUIRED')) {
        return NextResponse.json({ error: '只有项目探索记录可以设为完成作品' }, { status: 400 })
      }
      throw error
    }

    const result = (data || {}) as PromoteResult
    return NextResponse.json({
      id: Number(result.completion_id) || completionId,
      status: result.status || 'approved',
      recordKind: result.record_kind || 'final',
      xpAwarded: result.xp_awarded === true,
      alreadyFinal: result.already_final === true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
