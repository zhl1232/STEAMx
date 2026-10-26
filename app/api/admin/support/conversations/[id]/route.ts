import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { conversationFor, supportSession } from '@/lib/support/server'
import { cursor, SupportError } from '@/lib/support/validation'
import type { ConversationRoute } from '@/lib/support/handlers'
export async function PATCH(request: NextRequest, route: ConversationRoute) {
  try {
    const ctx = await supportSession(true)
    const conversation = await conversationFor(ctx, (await route.params).id)
    const { status, expectedLastMessageSeq } = await request.json()
    const expected = cursor(String(expectedLastMessageSeq))
    if (expected === null) throw new SupportError('缺少会话消息位置')
    if (!['open','resolved'].includes(status)) throw new SupportError('无效的会话状态')
    const result = await ctx.db.from('support_conversations').update({ status }).eq('id',conversation.id).eq('last_message_seq', expected).select('id').maybeSingle()
    if (result.error) throw result.error
    if (!result.data) throw new SupportError('会话有新留言，请刷新后再处理', 409)
    return NextResponse.json({ success:true })
  } catch(error) { return handleApiError(error) }
}
