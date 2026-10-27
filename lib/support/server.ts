import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth, requireRole } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupportError, supportChannel, uuid } from './validation'
import type { SupportChannel } from './channels'
import type { SupportConversation, SupportMessage } from './types'

// Tables are migration-owned until generated database types are refreshed.
export function supportDb(): SupabaseClient {
  if (!supabaseAdmin) throw new SupportError('客服服务暂时不可用，请稍后重试', 503)
  return supabaseAdmin as unknown as SupabaseClient
}
export async function supportSession(admin = false) {
  const session = await createClient()
  const user = admin ? (await requireRole(session, ['admin'])).user : await requireAuth(session)
  return { session, user, db: supportDb(), admin }
}
export type SupportSession = Awaited<ReturnType<typeof supportSession>>
export async function conversationFor(ctx: SupportSession, id: string) {
  const { data, error } = await ctx.db.from('support_conversations').select('*').eq('id', uuid(id)).maybeSingle()
  if (error) throw error
  if (!data || (!ctx.admin && data.user_id !== ctx.user.id)) throw new SupportError('会话不存在', 404)
  return data as SupportConversation
}
export async function ownConversation(ctx: SupportSession, channel: SupportChannel = 'platform') {
  const result = await ctx.db.rpc('support_ensure_conversation', { p_user: ctx.user.id, p_channel: supportChannel(channel) })
  if (result.error) throw result.error
  return result.data as SupportConversation
}
export async function sendSupportMessage(ctx: SupportSession, conversation: SupportConversation, body: Record<string, unknown>) {
  const clientId = uuid(body.clientId)
  const existing = await ctx.db.from('support_messages').select('*').eq('conversation_id', conversation.id).eq('actor_id', ctx.user.id).eq('client_id', clientId).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as SupportMessage
  await requireRateLimit(ctx.session, { key: ctx.admin ? 'support-staff-send' : 'support-user-send', limit: ctx.admin ? 120 : 20, windowMs: 60_000 })
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const attachments = body.attachmentIds === undefined ? [] : body.attachmentIds
  if (!Array.isArray(attachments) || attachments.length > 3) throw new SupportError('每条消息最多添加 3 张图片')
  const attachmentIds = attachments.map(uuid)
  if (new Set(attachmentIds).size !== attachmentIds.length || (!content && !attachmentIds.length) || content.length > 2000) throw new SupportError('请输入 2000 字以内的内容或添加图片')
  if (conversation.channel !== 'store' && (body.orderId || body.productId)) throw new SupportError('请在商城客服中咨询商品或订单')
  const context: SupportMessage['context'] = {}
  if (body.orderId) {
    const order = await ctx.db.from('store_orders').select('id,status,user_id').eq('id', uuid(body.orderId)).eq('user_id', conversation.user_id).maybeSingle()
    if (order.error) throw order.error
    if (!order.data) throw new SupportError('订单不可用', 404)
    context.orderId = order.data.id; context.orderStatus = order.data.status
  }
  if (body.productId) {
    const product = await ctx.db.from('store_products').select('id,name').eq('id', uuid(body.productId)).eq('status', 'active').maybeSingle()
    if (product.error) throw product.error
    if (!product.data) throw new SupportError('商品不可用', 404)
    context.productId = product.data.id; context.productName = product.data.name
  }
  const result = await ctx.db.rpc('support_send_message', { p_conversation: conversation.id, p_actor: ctx.user.id, p_role: ctx.admin ? 'admin' : 'user', p_client: clientId, p_content: content, p_context: context, p_attachments: attachmentIds })
  if (result.error) throw result.error
  return result.data as SupportMessage
}
