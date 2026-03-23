import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum } from '@/lib/api/validation'

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { searchParams } = new URL(request.url)
    const status = validateEnum(
      searchParams.get('status') || 'pending',
      'status',
      ['pending', 'resolved', 'dismissed', 'all'] as const
    )
    const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = Math.min(50, parsePositiveInt(searchParams.get('limit'), 20))
    const offset = (page - 1) * limit

    let query = supabase
      .from('reports')
      .select('*, reporter:reporter_id(username, display_name, avatar_url)', { count: 'exact' })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      reports: data,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
