import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { conversationFor, sendSupportMessage, supportSession } from './server'
import { cursor, SupportError } from './validation'
import type { SupportAttachment, SupportMessage } from './types'
export type ConversationRoute = { params: Promise<{ id: string }> }
export function messagesHandler(admin: boolean, method: 'GET' | 'POST') {
  return async (request: NextRequest, route: ConversationRoute) => {
    try {
      const ctx = await supportSession(admin)
      const conversation = await conversationFor(ctx, (await route.params).id)
      if (method === 'POST') return NextResponse.json({ message: await sendSupportMessage(ctx, conversation, await request.json()) })
      const before = cursor(request.nextUrl.searchParams.get('before'))
      const after = cursor(request.nextUrl.searchParams.get('after'))
      if (before !== null && after !== null) throw new SupportError('不能同时指定前后消息位置')
      let query = ctx.db.from('support_messages').select('id,seq,actor_id,sender_role,client_id,content,context,created_at').eq('conversation_id', conversation.id).order('seq', { ascending: after !== null }).limit(51)
      if (before !== null) query = query.lt('seq', before)
      if (after !== null) query = query.gt('seq', after)
      const result = await query
      if (result.error) throw result.error
      const hasMore = result.data.length > 50
      const page = result.data.slice(0,50)
      if (after === null) page.reverse()
      const messages = page.map(message => {
        if (!admin) delete message.actor_id
        return message
      }) as SupportMessage[]
      if (messages.length) {
        const attachments = await ctx.db.from('support_attachments').select('id,mime_type,size_bytes,message_id').in('message_id', messages.map(m => m.id))
        if (attachments.error) throw attachments.error
        for (const message of messages) message.attachments = (attachments.data as SupportAttachment[]).filter(a => a.message_id === message.id)
      }
      return NextResponse.json({ conversation, messages, nextCursor: after === null && hasMore ? messages[0].seq : null, nextAfterCursor: after !== null && hasMore ? messages.at(-1)!.seq : null }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
  }
}
export function readHandler(admin: boolean) {
  return async (request: NextRequest, route: ConversationRoute) => {
    try {
      const ctx = await supportSession(admin)
      const conversation = await conversationFor(ctx, (await route.params).id)
      const body = await request.json()
      const seq = cursor(String(body.seq))
      if (seq === null || seq > conversation.last_message_seq) throw new SupportError('无效的消息位置')
      const field = admin ? 'staff_read_seq' : 'user_read_seq'
      const result = await ctx.db.from('support_conversations').update({ [field]: seq }).eq('id', conversation.id).lt(field, seq)
      if (result.error) throw result.error
      return NextResponse.json({ success: true })
    } catch (error) { return handleApiError(error) }
  }
}
