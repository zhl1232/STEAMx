import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { supportSession } from '@/lib/support/server'
import type { SupportConversation } from '@/lib/support/types'
import { channelFromSearch } from '@/lib/support/validation'
import { supportNotificationHealth } from '@/lib/support/notifications'
export async function GET(request: NextRequest) {
  try {
    const channel = channelFromSearch(request.nextUrl.searchParams)
    const ctx = await supportSession(true)
    const offset = Math.max(0, Math.min(100000, Number(request.nextUrl.searchParams.get('offset')) || 0))
    const result = await ctx.db.rpc('support_inbox_channel', { p_channel: channel, p_offset: Math.floor(offset) })
    if (result.error) throw result.error
    const conversations = result.data as (SupportConversation & {unreadCount:number})[]
    const outbox = await ctx.db.from('support_notification_outbox').select('conversation_id,support_conversations!inner(channel)',{count:'exact',head:true}).eq('support_conversations.channel',channel).is('delivered_at',null)
    if (outbox.error) throw outbox.error
    return NextResponse.json({ conversations, nextOffset: conversations.length===50 ? offset+50 : null, notificationHealth: { ...supportNotificationHealth(), pending: outbox.count ?? 0 } },{headers:{'Cache-Control':'no-store'}})
  } catch(error) { return handleApiError(error) }
}
