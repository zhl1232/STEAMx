import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'

const STATUSES = ['resolved', 'dismissed'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { user } = await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const reportId = parseInt(id)
    if (isNaN(reportId) || reportId < 1) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const body = await request.json()
    const status = validateEnum(body?.status, 'status', STATUSES)
    const reviewer_note = validateOptionalString(body?.reviewer_note, 'reviewer_note', 1000)

    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        reviewer_id: user.id,
        reviewer_note: reviewer_note || null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id, status')
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: '举报不存在或已处理' }, { status: 404 })
    }

    return NextResponse.json({ report: data })
  } catch (error) {
    return handleApiError(error)
  }
}
