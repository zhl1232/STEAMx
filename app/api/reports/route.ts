import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateEnum, validateNumber, validateOptionalString } from '@/lib/api/validation'

const CONTENT_TYPES = ['project', 'discussion', 'discussion_reply', 'comment', 'message', 'completion_comment', 'observation'] as const
const REASONS = ['spam', 'harassment', 'inappropriate', 'illegal', 'other'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-reports', limit: 10, windowMs: 60_000 })

    const body = await request.json()

    const content_type = validateEnum(body?.content_type, 'content_type', CONTENT_TYPES)
    const content_id = validateNumber(body?.content_id, 'content_id', { integer: true, min: 1 })
    const reason = validateEnum(body?.reason, 'reason', REASONS)
    const description = validateOptionalString(body?.description, 'description', 500)

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        content_type,
        content_id,
        reason,
        description: description || null,
      } as never)
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '您已经举报过该内容' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
