import { decryptStoreAddress } from '@/lib/store/address-crypto'
import { Alibaba1688Client, Alibaba1688Error, getAlibaba1688Config } from '@/lib/store/alibaba-1688'
import { decryptStoreSecret, encryptStoreSecret } from '@/lib/store/secret-crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/supabase/types'

type AdminClient = NonNullable<typeof supabaseAdmin>
type Order = Database['public']['Tables']['store_orders']['Row']
type OrderItem = Database['public']['Tables']['store_order_items']['Row']

export class AlibabaOrderError extends Error {
  constructor(message: string, public readonly code = 'ALIBABA_ORDER_FAILED') {
    super(message)
    this.name = 'AlibabaOrderError'
  }
}

function adminClient(): AdminClient {
  if (!supabaseAdmin) throw new AlibabaOrderError('数据库管理员密钥尚未配置', 'STORE_ADMIN_UNAVAILABLE')
  return supabaseAdmin
}

function extractOrderId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['orderId', 'order_id', 'tradeId', 'trade_id', 'id']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
  }
  for (const key of ['result', 'data', 'order', 'model', 'success']) {
    const nested = extractOrderId(record[key])
    if (nested) return nested
  }
  return null
}

async function getConnection(client: AdminClient) {
  const { data, error } = await client
    .from('store_alibaba_connections')
    .select('*')
    .eq('connection_key', 'default')
    .maybeSingle()
  if (error) throw error
  if (!data || data.status !== 'active') throw new AlibabaOrderError('1688 尚未完成授权', 'ALIBABA_NOT_CONNECTED')

  const config = getAlibaba1688Config()
  const alibaba = new Alibaba1688Client(config)
  let accessToken = decryptStoreSecret(data.access_token_encrypted)
  const refreshToken = data.refresh_token_encrypted ? decryptStoreSecret(data.refresh_token_encrypted) : null
  const expiresSoon = data.expires_at && new Date(data.expires_at).getTime() < Date.now() + 120_000
  if (expiresSoon && !refreshToken) {
    throw new AlibabaOrderError('1688 授权已过期，请管理员重新授权', 'ALIBABA_TOKEN_EXPIRED')
  }
  if (expiresSoon && refreshToken) {
    const refreshed = await alibaba.refreshAccessToken(refreshToken)
    if (!refreshed.access_token) throw new AlibabaOrderError('1688 刷新授权失败', 'ALIBABA_TOKEN_REFRESH_FAILED')
    accessToken = refreshed.access_token
    const expiresIn = Number(refreshed.expires_in)
    const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : data.expires_at
    const { error: updateError } = await client.from('store_alibaba_connections').update({
      access_token_encrypted: encryptStoreSecret(accessToken),
      refresh_token_encrypted: refreshed.refresh_token ? encryptStoreSecret(refreshed.refresh_token) : data.refresh_token_encrypted,
      expires_at: expiresAt,
      status: 'active',
    }).eq('connection_key', 'default')
    if (updateError) throw updateError
  }
  return { alibaba, accessToken }
}

function createOrderParam(order: Order, items: OrderItem[]) {
  let address
  try {
    address = decryptStoreAddress(order.address_snapshot_encrypted)
  } catch {
    throw new AlibabaOrderError('订单收货地址无法解密', 'STORE_ADDRESS_DECRYPT_FAILED')
  }
  if (!items.length || items.some((item) => !item.offer_id)) {
    throw new AlibabaOrderError('订单缺少 1688 商品映射', 'ALIBABA_SOURCE_MISSING')
  }
  const cargoParamList = items.map((item) => ({
    offerId: item.offer_id,
    specId: item.spec_id || undefined,
    quantity: item.quantity,
  }))
  const addressParam = {
    fullName: address.recipientName,
    mobile: address.phone,
    province: address.province,
    city: address.city,
    area: address.district,
    address: address.street,
    postCode: address.postalCode || undefined,
  }
  return {
    outOrderId: order.external_order_id || order.id,
    addressParam,
    cargoParamList,
  }
}

export async function createAlibabaOrderForStoreOrder(orderId: string) {
  const client = adminClient()
  const { data: order, error: orderError } = await client.from('store_orders').select('*').eq('id', orderId).single()
  if (orderError || !order) throw new AlibabaOrderError('订单不存在', 'STORE_ORDER_NOT_FOUND')
  if (order.alibaba_order_id) return { orderId: order.id, alibabaOrderId: order.alibaba_order_id, reused: true }
  if (order.payment_status !== 'paid') throw new AlibabaOrderError('订单尚未支付', 'STORE_ORDER_NOT_PAID')

  try {
    const { data: items, error: itemsError } = await client.from('store_order_items').select('*').eq('order_id', order.id)
    if (itemsError) throw itemsError
    const param = createOrderParam(order, items ?? [])
    const { alibaba, accessToken } = await getConnection(client)
    const apiName = process.env.ALIBABA_1688_ORDER_API?.trim() || 'alibaba.trade.fastCreateOrder'
    await client.from('store_orders').update({ status: 'sourcing', failure_code: null, failure_message: null }).eq('id', order.id)
    const payload = await alibaba.execute<unknown>(apiName, {
      outOrderId: param.outOrderId,
      addressParam: JSON.stringify(param.addressParam),
      cargoParamList: JSON.stringify(param.cargoParamList),
      param: JSON.stringify(param),
    }, accessToken, { idempotent: true })
    const alibabaOrderId = extractOrderId(payload)
    if (!alibabaOrderId) throw new AlibabaOrderError('1688 返回中缺少订单编号', 'ALIBABA_ORDER_ID_MISSING')

    const { error: updateError } = await client.from('store_orders').update({
      status: 'ordered',
      alibaba_order_id: alibabaOrderId,
      ordered_at: new Date().toISOString(),
      alibaba_status: 'created',
    }).eq('id', order.id).is('alibaba_order_id', null)
    if (updateError) throw updateError
    await client.from('store_order_items').update({ alibaba_order_id: alibabaOrderId }).eq('order_id', order.id)
    await client.from('store_order_events').insert({
      order_id: order.id,
      event_type: 'alibaba_order_created',
      message: '已向 1688 提交代发采购单',
      payload: { alibabaOrderId } as unknown as Json,
    })
    return { orderId: order.id, alibabaOrderId, reused: false }
  } catch (error) {
    const code = error instanceof Alibaba1688Error ? error.code || 'ALIBABA_API_ERROR' : error instanceof AlibabaOrderError ? error.code : 'ALIBABA_ORDER_FAILED'
    const message = error instanceof AlibabaOrderError || error instanceof Alibaba1688Error ? error.message : '1688 采购单创建失败'
    await client.from('store_orders').update({ status: 'failed', failure_code: code, failure_message: message }).eq('id', order.id)
    await client.from('store_order_events').insert({ order_id: order.id, event_type: 'alibaba_order_failed', message: '1688 采购单创建失败', payload: { code } as unknown as Json })
    throw error
  }
}

export async function runDueStoreSyncJobs(limit = 10) {
  const client = adminClient()
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)))
  const { data: jobs, error } = await client.from('store_sync_jobs').select('*')
    .in('status', ['queued', 'failed']).lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true }).limit(safeLimit)
  if (error) throw error
  const results: Array<{ jobId: number; ok: boolean; error?: string }> = []
  for (const job of jobs ?? []) {
    const { data: claimed } = await client.from('store_sync_jobs').update({ status: 'running', locked_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq('id', job.id).in('status', ['queued', 'failed']).select('id').maybeSingle()
    if (!claimed) continue
    try {
      if (job.job_type !== 'create_alibaba_order' || !job.order_id) throw new AlibabaOrderError('暂不支持该同步任务类型', 'STORE_SYNC_JOB_UNSUPPORTED')
      await createAlibabaOrderForStoreOrder(job.order_id)
      await client.from('store_sync_jobs').update({ status: 'succeeded', locked_at: null, last_error: null }).eq('id', job.id)
      results.push({ jobId: job.id, ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步任务失败'
      await client.from('store_sync_jobs').update({ status: 'failed', locked_at: null, last_error: message, next_run_at: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts, 6))).toISOString() }).eq('id', job.id)
      results.push({ jobId: job.id, ok: false, error: message })
    }
  }
  return { processed: results.length, results }
}
