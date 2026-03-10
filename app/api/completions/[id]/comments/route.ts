import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = Number(id)
    if (Number.isNaN(completionId)) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }

    const limit = Math.min(200, Math.max(1, parseNumber(request.nextUrl.searchParams.get('limit'), 200)))

    const { data, error } = await supabase
      .from('completion_comments')
      .select('id, content')
      .eq('completed_project_id', completionId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ comments: data || [] })
  } catch (error) {
    console.error('Error in GET /api/completions/[id]/comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const completionId = Number(id)
    if (Number.isNaN(completionId)) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
    }
    if (content.length > 500) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('completion_comments')
      .insert({
        completed_project_id: completionId,
        author_id: user.id,
        content,
      } as never)
      .select('id, content')
      .single()

    if (error) throw error

    return NextResponse.json({ comment: data })
  } catch (error) {
    return handleApiError(error)
  }
}
