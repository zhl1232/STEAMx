import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { MessageSchema } from '@/lib/schemas'
import type { Message } from '@/lib/types/database'

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { userId } = await params
    if (!userId || userId === user.id) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const limitParam = searchParams.get('limit')
    const limit = limitParam
      ? Math.min(200, Math.max(1, parseNumber(limitParam, 50)))
      : null
    const before = searchParams.get('before')

    let query = supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false })

    if (before) {
      query = query.lt('created_at', before)
    }
    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error

    type MsgRow = { id: number; sender_id: string; receiver_id: string; content: string; created_at: string }
    const merged = (data || []) as MsgRow[]
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const messages = merged
      .map((row) => {
        const result = MessageSchema.safeParse(row)
        return result.success ? result.data : null
      })
      .filter((x): x is Message => x !== null)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      messages,
      peer: profile,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
