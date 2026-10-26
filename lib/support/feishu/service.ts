import 'server-only'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { supportDb } from '../server'
import { validateContentSafe } from '@/lib/api/validation'
import { moderateTextContent } from '@/lib/safety/server'
import { FeishuBridgeError, feishuId, getFeishuConfig, type FeishuConfig, type FeishuEventKind, type FeishuTarget } from './config'
import { getFeishuClient } from './client'
export { feishuHealth } from './config'

type Discovery = { chatId: string; openId: string; appId: string; recordedAt: string }
type Inbound = { message_id: string; chat_id: string; sender_open_id: string; parent_id: string | null; root_id: string | null; text: string; lease_id: string; attempts: number }
type Delivery = { event_id: string; target_id: string; lease_id: string; attempts: number; kind: FeishuEventKind; support_message_id: string | null; order_event_id: number | null; chat_id: string }
const DISCOVERY_FILE = '/tmp/chuangtan-feishu-discovery.jsonl'
const DISCOVERY_LIMIT = 64 * 1024
let discoveryQueue = Promise.resolve()
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const tenant = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)

async function discoveryRecords(file: Awaited<ReturnType<typeof open>>) {
  const size = (await file.stat()).size
  if (size > DISCOVERY_LIMIT) throw new FeishuBridgeError('discovery_limit')
  const buffer = Buffer.alloc(DISCOVERY_LIMIT)
  const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
  const rows: Discovery[] = []
  for (const line of buffer.subarray(0, bytesRead).toString('utf8').split('\n').filter(Boolean)) {
    try {
      const item = JSON.parse(line) as Discovery
      if (feishuId(item.chatId, 'oc_') && feishuId(item.openId, 'ou_') && /^cli_[0-9a-fA-F]{16}$/.test(item.appId) && typeof item.recordedAt === 'string') rows.push({ chatId: item.chatId, openId: item.openId, appId: item.appId, recordedAt: item.recordedAt })
    } catch { /* An incomplete line is never reflected back as arbitrary JSON. */ }
  }
  return rows
}
export async function readDiscovery(): Promise<Discovery[]> {
  let file
  try {
    file = await open(DISCOVERY_FILE, constants.O_RDONLY | constants.O_NOFOLLOW)
    return await discoveryRecords(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new FeishuBridgeError('discovery_unavailable')
  } finally { await file?.close() }
}
async function saveDiscovery(value: Omit<Discovery, 'recordedAt'>) {
  const operation = discoveryQueue.then(async () => {
    let file
    try {
      file = await open(DISCOVERY_FILE, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW, 0o600)
      await file.chmod(0o600)
      const existing = await discoveryRecords(file)
      if (existing.some(row => row.appId === value.appId && row.chatId === value.chatId && row.openId === value.openId)) return
      const line = `${JSON.stringify({ ...value, recordedAt: new Date().toISOString() })}\n`
      const size = (await file.stat()).size
      if (size + Buffer.byteLength(line) > DISCOVERY_LIMIT) throw new FeishuBridgeError('discovery_limit')
      await file.write(line, size, 'utf8')
      await file.sync()
    } catch { throw new FeishuBridgeError('discovery_unavailable') }
    finally { await file?.close() }
  })
  discoveryQueue = operation.catch(() => {})
  return operation
}

function activeSupportTarget(config: FeishuConfig, chatId: string): FeishuTarget | undefined {
  return config.targets.find(target => target.enabled && target.chatId === chatId && target.events.includes('support.user_message'))
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = await supportDb().rpc(name, args)
  if (result.error) throw new FeishuBridgeError('database_unavailable')
  return result.data as T
}

/** This endpoint is fed by our authenticated long-connection worker, never a public callback. */
export async function enqueueFeishuEvent(input: unknown) {
  const config = getFeishuConfig()
  if (!config) throw new FeishuBridgeError('bridge_disabled')
  if (!record(input) || input.app_id !== config.appId) throw new FeishuBridgeError('event_app_invalid', 400)
  if (!record(input.sender) || !record(input.message)) throw new FeishuBridgeError('event_invalid', 400)
  const sender = input.sender, message = input.message
  if (sender.sender_type !== 'user' || message.chat_type !== 'group' || message.message_type !== 'text') return { ignored: true }
  if (!record(sender.sender_id) || !feishuId(sender.sender_id.open_id, 'ou_') || !feishuId(message.chat_id, 'oc_') || !feishuId(message.message_id, 'om_')) throw new FeishuBridgeError('event_identity_invalid', 400)
  const senderOpenId = sender.sender_id.open_id
  if (typeof input.event_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.event_id) || !tenant(input.tenant_key) || sender.tenant_key !== input.tenant_key || (config.tenantKey && config.tenantKey !== input.tenant_key)) throw new FeishuBridgeError('event_tenant_invalid', 400)
  const parentId = message.parent_id || null, rootId = message.root_id || null
  if ((parentId && !feishuId(parentId, 'om_')) || (rootId && !feishuId(rootId, 'om_')) || typeof message.content !== 'string' || message.content.length > 16000 || !Array.isArray(message.mentions) || message.mentions.length > 50) throw new FeishuBridgeError('event_invalid', 400)
  let text: string
  try {
    const content: unknown = JSON.parse(message.content)
    if (!record(content) || typeof content.text !== 'string') throw new Error()
    text = content.text
  } catch { throw new FeishuBridgeError('event_content_invalid', 400) }
  if (!message.mentions.length) return { ignored: true }
  const botId = await getFeishuClient(config).botOpenId()
  const mentions = message.mentions.filter(item => record(item) && record(item.id) && item.id.open_id === botId && typeof item.key === 'string' && item.key.length > 0 && item.key.length <= 100) as { key: string }[]
  if (!mentions.length) return { ignored: true }
  for (const mention of mentions) text = text.split(mention.key).join('')
  text = text.trim()
  if (text === '绑定客服' && !parentId && !rootId) {
    await saveDiscovery({ chatId: message.chat_id, openId: senderOpenId, appId: config.appId })
    return { discovered: true }
  }
  if (!parentId && !rootId) return { ignored: true }
  if (!activeSupportTarget(config, message.chat_id) || !config.staff.some(person => person.openId === senderOpenId)) return { ignored: true }
  if (!text || text.length > 2000) throw new FeishuBridgeError('reply_content_invalid', 400)
  const inserted = await rpc<boolean>('feishu_enqueue_inbound', { p_message_id: message.message_id, p_chat_id: message.chat_id, p_sender_open_id: senderOpenId, p_parent_id: parentId, p_root_id: rootId, p_text: text })
  return { queued: true, duplicate: !inserted }
}

async function parallelTwo<T>(items: T[], action: (item: T) => Promise<void>) {
  let index = 0
  await Promise.all([0, 1].map(async () => { while (index < items.length) await action(items[index++]) }))
}
async function requireRow<T>(table: string, columns: string, field: string, value: string | number): Promise<T> {
  const result = await supportDb().from(table).select(columns).eq(field, value).maybeSingle()
  if (result.error) throw new FeishuBridgeError('database_unavailable')
  if (!result.data) throw new FeishuBridgeError('source_unavailable')
  return result.data as T
}
function currentConfig(expected: FeishuConfig) {
  const config = getFeishuConfig()
  if (!config || config.appId !== expected.appId) throw new FeishuBridgeError('bridge_configuration_changed')
  return config
}
async function outboundText(job: Delivery, config: FeishuConfig) {
  if (job.kind.startsWith('support.')) {
    if (!job.support_message_id) throw new FeishuBridgeError('source_unavailable')
    const message = await requireRow<{ content: string; sender_role: 'user' | 'admin'; conversation_id: string }>('support_messages', 'content,sender_role,conversation_id', 'id', job.support_message_id)
    const conversation = await requireRow<{ channel: 'platform' | 'store' }>('support_conversations', 'channel', 'id', message.conversation_id)
    const target = config.targets.find(item => item.id === job.target_id && item.chatId === job.chat_id && item.enabled && item.events.includes(job.kind) && item.channels.includes(conversation.channel))
    if (!target) throw new FeishuBridgeError('target_unavailable')
    const attachments = await supportDb().from('support_attachments').select('id', { count: 'exact', head: true }).eq('message_id', job.support_message_id)
    if (attachments.error) throw new FeishuBridgeError('database_unavailable')
    const label = conversation.channel === 'store' ? '商城客服' : '平台帮助'
    const text = [`${label} · 会话 ${message.conversation_id.slice(0, 8)}`, `${message.sender_role === 'user' ? '用户' : '客服'}：${message.content || '（图片消息）'}`, ...(attachments.count ? ['有图片，请在后台查看。'] : []), '回复本消息并 @机器人，可同步给用户。', ...(config.siteUrl ? [`${config.siteUrl}/admin/support?channel=${conversation.channel}&conversation=${message.conversation_id}`] : [])].join('\n')
    return { text, support: true }
  }
  const target = config.targets.find(item => item.id === job.target_id && item.chatId === job.chat_id && item.enabled && item.events.includes(job.kind) && item.channels.includes('store'))
  if (!target || job.order_event_id === null) throw new FeishuBridgeError('target_unavailable')
  const event = await requireRow<{ order_id: string }>('store_order_events', 'order_id', 'id', job.order_event_id)
  // Read the committed order: the created event precedes the final v1 member/coupon amount update.
  const order = await requireRow<{ id: string; total_cents: number; status: string }>('store_orders', 'id,total_cents,status', 'id', event.order_id)
  if (!Number.isSafeInteger(order.total_cents) || order.total_cents < 0) throw new FeishuBridgeError('source_unavailable')
  const titles: Record<string, string> = { 'order.created': '新订单，待付款', 'order.paid': '订单已支付，待处理', 'order.refund_requested': '收到售后申请，待审核', 'order.refunded': '订单退款已完成' }
  return { text: [`${titles[job.kind]} · ${order.id.slice(0, 8)}`, `订单金额：¥${(order.total_cents / 100).toFixed(2)}`, ...(config.siteUrl ? [`${config.siteUrl}/admin/store?order=${order.id}`] : [])].join('\n'), support: false }
}

export async function runFeishuDispatch() {
  const config = getFeishuConfig()
  if (!config) return { disabled: true, sent: 0, failed: 0, replies: 0, rejected: 0 }
  const counters = { disabled: false, sent: 0, failed: 0, replies: 0, rejected: 0 }
  await rpc('feishu_sync_targets', { p_targets: config.targets.map(target => ({ target_id: target.id, chat_id: target.chatId, enabled: target.enabled, channels: target.channels, events: target.events })) })
  const incoming = await rpc<Inbound[]>('feishu_claim_inbound', { p_limit: 5 })
  await parallelTwo(incoming ?? [], async job => {
    let permanent = false
    let failure = 'reply_failed'
    try {
      const latest = currentConfig(config)
      const person = latest.staff.find(staff => staff.openId === job.sender_open_id)
      if (!person || !activeSupportTarget(latest, job.chat_id)) { permanent = true; throw new FeishuBridgeError('reply_rejected') }
      const profile = await supportDb().from('profiles').select('role').eq('id', person.profileId).maybeSingle()
      if (profile.error) throw new FeishuBridgeError('database_unavailable')
      if (!profile.data || profile.data.role !== 'admin') { permanent = true; throw new FeishuBridgeError('reply_rejected') }
      try {
        validateContentSafe(job.text, '客服消息')
        if (!job.text.trim() || job.text.length > 2000 || moderateTextContent(job.text, 'public').state === 'rejected') throw new Error()
      } catch { permanent = true; throw new FeishuBridgeError('reply_rejected') }
      const applied = await supportDb().rpc('feishu_apply_reply', { p_message_id: job.message_id, p_chat_id: job.chat_id, p_actor: person.profileId, p_parent_id: job.parent_id, p_root_id: job.root_id, p_content: job.text })
      if (applied.error) {
        // An anchor may still be committing after its HTTP send; that condition must retry.
        const message = typeof applied.error.message === 'string' ? applied.error.message : ''
        permanent = /administrator required|target unavailable|Ambiguous Feishu|identity mismatch|Invalid Feishu reply/.test(message)
        if (message === 'Feishu reply anchor unavailable' && job.attempts >= 5) {
          permanent = true
          failure = 'reply_anchor_unavailable'
        }
        throw new FeishuBridgeError(permanent ? 'reply_rejected' : 'reply_failed')
      }
      if (!applied.data || typeof applied.data.message_id !== 'string') throw new FeishuBridgeError('reply_failed')
      if (!await rpc<boolean>('feishu_complete_inbound', { p_message_id: job.message_id, p_lease: job.lease_id, p_success: true })) throw new FeishuBridgeError('lease_lost')
      counters.replies++
    } catch {
      const ack = await rpc<boolean>('feishu_complete_inbound', { p_message_id: job.message_id, p_lease: job.lease_id, p_success: false, p_error: failure === 'reply_anchor_unavailable' ? failure : permanent ? 'reply_rejected' : 'reply_failed', p_permanent: permanent })
      if (!ack) counters.failed++
      if (permanent) counters.rejected++; else counters.failed++
    }
  })
  if (!config.targets.some(target => target.enabled)) return counters
  const outgoing = await rpc<Delivery[]>('feishu_claim_deliveries', { p_limit: 5 })
  const timeout = AbortSignal.timeout(25000)
  await parallelTwo(outgoing ?? [], async job => {
    try {
      const latest = currentConfig(config)
      const payload = await outboundText(job, latest)
      const messageId = await getFeishuClient(latest).sendText(job.chat_id, payload.text, job.event_id, job.target_id, timeout)
      if (payload.support && !await rpc<boolean>('feishu_record_anchor', { p_event: job.event_id, p_target: job.target_id, p_lease: job.lease_id, p_message_id: messageId })) throw new FeishuBridgeError('lease_lost')
      if (!await rpc<boolean>('feishu_complete_delivery', { p_event: job.event_id, p_target: job.target_id, p_lease: job.lease_id, p_success: true })) throw new FeishuBridgeError('lease_lost')
      counters.sent++
    } catch {
      await rpc('feishu_complete_delivery', { p_event: job.event_id, p_target: job.target_id, p_lease: job.lease_id, p_success: false, p_error: 'delivery_failed' })
      counters.failed++
    }
  })
  return counters
}
