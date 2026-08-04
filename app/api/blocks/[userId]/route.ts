import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { userId } = await params
    const blockedUserId = validateUUID(userId, 'userId')

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_user_id', blockedUserId)
    if (error) throw error

    return NextResponse.json({ blocked: false, userId: blockedUserId })
  } catch (error) {
    return handleApiError(error)
  }
}
