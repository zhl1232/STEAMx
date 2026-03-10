import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { MessageSchema } from '@/lib/schemas'
import type { Message } from '@/lib/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { userId } = await params
    if (!userId || userId === user.id) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const [res1, res2] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .eq('sender_id', user.id)
        .eq('receiver_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .eq('sender_id', userId)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: true }),
    ])

    if (res1.error) throw res1.error
    if (res2.error) throw res2.error

    type MsgRow = { id: number; sender_id: string; receiver_id: string; content: string; created_at: string }
    const merged = [...(res1.data || []), ...(res2.data || [])] as MsgRow[]
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
