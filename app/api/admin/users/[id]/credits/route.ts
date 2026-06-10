import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])
    const { id: userId } = await params
    const body = await req.json()
    const amount = Number(body?.amount)
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : null

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: '请输入非零整数' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('admin_adjust_ai_credit', {
      p_target_user_id: userId,
      p_amount: Math.trunc(amount),
      p_note: note,
    } as never)

    if (error) throw error
    const result = (data ?? null) as { ok?: boolean; balance?: number; error?: string } | null
    if (!result?.ok) {
      return NextResponse.json({ error: result?.error ?? '调整失败' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, balance: result.balance ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])
    const { id: userId } = await params

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务不可用' }, { status: 500 })
    }

    const { data: wallet } = await supabaseAdmin
      .from('ai_credit_wallets')
      .select('balance, grant_period, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({ wallet: wallet ?? { balance: 0 } })
  } catch (error) {
    return handleApiError(error)
  }
}
