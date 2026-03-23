import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

function parseNotificationId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null

  return parsed
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json()
    const id = parseNotificationId(body?.id)
    if (!id) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_read', false)
      .select('id')
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ ok: true, changed: Boolean(data) })
  } catch (error) {
    return handleApiError(error)
  }
}
