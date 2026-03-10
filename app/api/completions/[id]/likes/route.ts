import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = Number(id)
    if (Number.isNaN(completionId)) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }

    const { count, error: countError } = await supabase
      .from('completion_likes')
      .select('*', { count: 'exact', head: true })
      .eq('completed_project_id', completionId)

    if (countError) throw countError

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let isLiked = false
    if (user) {
      const { data: likeRow, error: likeError } = await supabase
        .from('completion_likes')
        .select('id')
        .eq('completed_project_id', completionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (likeError) throw likeError
      isLiked = !!likeRow
    }

    return NextResponse.json({
      count: count || 0,
      isLiked,
    })
  } catch (error) {
    console.error('Error in GET /api/completions/[id]/likes:', error)
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
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

    const { error } = await supabase
      .from('completion_likes')
      .insert({
        completed_project_id: completionId,
        user_id: user.id,
      } as never)

    if (error && error.code !== '23505') {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const { error } = await supabase
      .from('completion_likes')
      .delete()
      .eq('completed_project_id', completionId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
