import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { userId } = await params
    validateUUID(userId, 'userId')

    if (userId === user.id) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const readAt = new Date().toISOString()
    const { error } = await supabase
      .from('messages')
      .update({ read_at: readAt } as never)
      .eq('sender_id', userId)
      .eq('receiver_id', user.id)
      .is('read_at', null)

    if (error) throw error

    return NextResponse.json({ readAt })
  } catch (error) {
    return handleApiError(error)
  }
}
