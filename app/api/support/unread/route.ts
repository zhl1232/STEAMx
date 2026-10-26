import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { supportSession } from '@/lib/support/server'
export async function GET() {
  try {
    const ctx = await supportSession()
    const result = await ctx.db.rpc('support_user_unread', { p_user: ctx.user.id })
    if (result.error) throw result.error
    const unreadByChannel = result.data as { platform: number; store: number }
    return NextResponse.json({ unreadCount: unreadByChannel.platform + unreadByChannel.store, unreadByChannel }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}
