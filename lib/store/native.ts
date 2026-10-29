import { randomUUID } from 'node:crypto'

import {
  encryptStoreAddress,
  maskRecipientName,
  phoneLast4,
  type StoreAddressPayload,
} from '@/lib/store/address-crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/supabase/types'

export type NativeOrderItem = { variantId: string; quantity: number }
export type NativeOrderInput = {
  userId: string
  idempotencyKey?: string
  province: string
  address: StoreAddressPayload
  items: NativeOrderItem[]
  expectedQuote?: StoreQuote
  couponId?: string | null
  useCoins?: boolean
}
export type NativePaymentAttempt = {
  id: string
  orderId: string
  merchantReference: string
  provider: string
  amountCents: number
  currency: 'CNY'
  status: 'pending' | 'succeeded' | 'failed' | 'closed'
}

export type StoreQuote = {
  originalSubtotalCents: number; memberSubtotalCents: number; memberDiscountCents: number
  membershipTier: 'free' | 'pro' | 'founder'; shippingCents: number
  couponDiscountCents: number; coinDiscountCents: number; coinsUsed: number; totalCents: number; couponId: string | null
}

class NativeStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 422,
  ) {
    super(message)
    this.name = 'NativeStoreError'
  }
}

function admin() {
  if (!supabaseAdmin)
    throw new NativeStoreError(
      '商城数据库未配置',
      'STORE_ADMIN_UNAVAILABLE',
      503,
    )
  return supabaseAdmin
}

// Native tables are introduced by the companion migration; keeping this adapter
// narrow lets older generated Supabase types remain usable until regeneration.
function nativeDb(): SupabaseClient {
  return admin() as unknown as SupabaseClient
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await nativeDb().rpc(name, args)
  if (error?.message?.includes('direct_coins_disabled')) throw new NativeStoreError('硬币抵扣已调整为兑换优惠券', 'DIRECT_COINS_DISABLED', 409)
  if (error?.message?.includes('offer_changed')) throw new NativeStoreError('兑换价格或条款已变化，请重新确认', 'OFFER_CHANGED', 409)
  if (error?.message?.includes('insufficient_coins')) throw new NativeStoreError('硬币不足', 'INSUFFICIENT_COINS', 409)
  if (error?.message?.includes('exchange_limit')) throw new NativeStoreError('已达到兑换数量上限', 'EXCHANGE_LIMIT', 409)
  if (error?.message?.includes('quote_changed'))
    throw new NativeStoreError('结算金额或优惠已变化，请重新确认', 'QUOTE_CHANGED', 409)
  if (error?.message?.includes('catalog_version_conflict'))
    throw new NativeStoreError('商品或库存已变化，请刷新页面后重新编辑', 'CATALOG_VERSION_CONFLICT', 409)
  if (error)
    throw new NativeStoreError(
      '商品库存或订单状态已变化，请刷新后重试',
      'STORE_STATE_CONFLICT',
      409,
    )
  if (data === null || data === undefined)
    throw new Error(`RPC ${name} returned no result`)
  return data as T
}

export async function createNativeOrder(input: NativeOrderInput) {
  const key = input.idempotencyKey?.trim() || `native-${randomUUID()}`
  const existing = await nativeDb().from('store_orders').select('id').eq('user_id', input.userId).eq('external_order_id', key).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return { orderId: existing.data.id as string, idempotencyKey: key }
  if (input.useCoins) throw new NativeStoreError('硬币抵扣已调整为兑换优惠券', 'DIRECT_COINS_DISABLED', 409)
  if (!input.expectedQuote) throw new NativeStoreError('请先确认结算金额', 'QUOTE_REQUIRED', 400)
  let encrypted: string
  try {
    encrypted = encryptStoreAddress(input.address)
  } catch {
    throw new NativeStoreError(
      '地址加密服务不可用',
      'ADDRESS_ENCRYPTION_UNAVAILABLE',
      503,
    )
  }
  const db = nativeDb()
  const { data: address, error: addressError } = await db
    .from('store_addresses')
    .insert({
      user_id: input.userId,
      label: '收货地址',
      recipient_name_masked: maskRecipientName(input.address.recipientName),
      phone_last4: phoneLast4(input.address.phone),
      payload_encrypted: encrypted,
      is_default: false,
    })
    .select('id')
    .single()
  if (addressError || !address)
    throw addressError || new Error('Failed to save address')
  try {
    const orderId = await rpc<string>('create_store_native_order_v1', {
      p_user_id: input.userId,
      p_external_order_id: key,
      p_address_id: address.id,
      p_address_snapshot_encrypted: encrypted,
      p_province: input.province,
      p_expected_quote: input.expectedQuote,
      p_coupon_id: input.couponId ?? null,
      p_use_coins: input.useCoins ?? false,
      p_items: input.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      })) as unknown as Json,
    })
    const persisted = await db
      .from('store_orders')
      .select('address_id')
      .eq('id', orderId)
      .single()
    if (persisted.data?.address_id !== address.id)
      await db.from('store_addresses').delete().eq('id', address.id)
    return { orderId, idempotencyKey: key }
  } catch (error) {
    await db.from('store_addresses').delete().eq('id', address.id)
    throw error
  }
}

export async function startNativePaymentAttempt(
  orderId: string,
  provider: string,
  clientToken: string,
): Promise<NativePaymentAttempt> {
  const id = await rpc<string>('start_store_payment_attempt', {
    p_order_id: orderId,
    p_provider: provider,
    p_client_token: clientToken,
  })
  return getNativePaymentAttempt(id)
}

export async function getNativePaymentAttempt(
  attemptId: string,
): Promise<NativePaymentAttempt> {
  const { data, error } = await nativeDb()
    .from('store_payment_attempts')
    .select('id, order_id, attempt_reference, provider, amount_cents, status')
    .eq('id', attemptId)
    .single()
  if (error || !data) throw error || new Error('Payment attempt not found')
  return {
    id: data.id,
    orderId: data.order_id,
    merchantReference: data.attempt_reference,
    provider: data.provider,
    amountCents: data.amount_cents,
    currency: 'CNY',
    status: data.status as NativePaymentAttempt['status'],
  }
}

export async function getNativePaymentAttemptByReference(reference: string) {
  const { data, error } = await nativeDb()
    .from('store_payment_attempts')
    .select('id')
    .eq('attempt_reference', reference)
    .maybeSingle()
  if (error) throw error
  return data ? getNativePaymentAttempt(data.id) : null
}

export async function confirmNativePayment(input: {
  attemptId: string
  amountCents: number
  currency: 'CNY'
  providerReference?: string
}) {
  return rpc<boolean>('confirm_store_payment', {
    p_attempt_id: input.attemptId,
    p_amount_cents: input.amountCents,
    p_currency: input.currency,
    p_provider_reference: input.providerReference ?? '',
  })
}

export async function closeNativePaymentAttempt(
  attemptId: string,
  confirmedClosed: boolean,
) {
  return rpc<boolean>('close_store_payment_attempt', {
    p_attempt_id: attemptId,
    p_confirmed_closed: confirmedClosed,
  })
}

export async function requestNativeRefund(input: {
  orderId: string
  userId: string
  reason: string
  returnFirst?: boolean
}) {
  return rpc<string>('request_store_refund', {
    p_order_id: input.orderId,
    p_user_id: input.userId,
    p_reason: input.reason,
    p_return_first: input.returnFirst ?? false,
  })
}

export async function confirmNativeRefund(input: {
  aftersaleId: string
  amountCents: number
  provider: string
  providerReference: string
}) {
  return rpc<boolean>('confirm_store_refund', {
    p_aftersale_id: input.aftersaleId,
    p_amount_cents: input.amountCents,
    p_provider: input.provider,
    p_provider_ref: input.providerReference,
  })
}

export type NativeProductAdminInput = {
  version?: number
  status?: 'draft' | 'active' | 'archived'
  slug: string
  name: string
  priceCents: number
  shippingCents: number | null
  source?: 'manual' | '1688'
  description?: string
  coverUrl?: string
  galleryUrls?: string[]
  detailContent?: string | null
  videoUrl?: string | null
  category?: string | null
  blockedProvinces?: string[]
  createdBy?: string | null
}

export type NativeVariantAdminInput = {
  version?: number
  id?: string
  name: string
  sku: string
  priceCents?: number | null
  stockQuantity: number | null
  minQuantity?: number
  supplierUrl?: string | null
  costCents?: number | null
}

export type NativeCatalogInput = NativeProductAdminInput & {
  fulfillmentDescription?: string | null
  contextKeys?: string[]
  variants: NativeVariantAdminInput[]
}

export async function saveNativeCatalog(
  productId: string | null,
  input: NativeCatalogInput,
) {
  return rpc<string>('save_store_native_catalog', {
    p_product_id: productId,
    p_product: {
      version: input.version,
      status: input.status ?? 'draft',
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      galleryUrls: input.galleryUrls ?? [],
      detailContent: input.detailContent ?? null,
      videoUrl: input.videoUrl ?? null,
      category: input.category ?? null,
      priceCents: input.priceCents,
      shippingCents: input.shippingCents,
      source: input.source ?? 'manual',
      blockedProvinces: input.blockedProvinces ?? [],
      fulfillmentDescription: input.fulfillmentDescription ?? null,
      contextKeys: input.contextKeys ?? [],
      createdBy: input.createdBy ?? null,
    },
    p_variants: input.variants,
  })
}

export async function quoteNativeOrder(input: {userId: string; province: string; items: NativeOrderItem[]; couponId?: string | null; useCoins?: boolean}): Promise<StoreQuote> {
  return rpc<StoreQuote>('quote_store_native_order', {
    p_user_id: input.userId, p_province: input.province,
    p_items: input.items.map(item => ({variant_id: item.variantId, quantity: item.quantity})),
    p_coupon_id: input.couponId ?? null, p_use_coins: input.useCoins ?? false,
  })
}

export async function listUserStoreCoupons(userId: string) {
  const [rows, tier] = await Promise.all([
    nativeDb().from('store_user_coupons').select('id,title,threshold_cents,discount_cents,terms,eligible_product_ids,expires_at,status,source,usage_policy').eq('user_id', userId).order('expires_at'),
    rpc<string>('store_effective_member_tier', {p_user_id: userId}),
  ])
  if (rows.error) throw rows.error
  return (rows.data ?? []).map(c => ({...c, eligible: (c.usage_policy === 'all' || tier === 'founder') && c.status === 'available' && Date.parse(c.expires_at) > Date.now()}))
}

export async function listStoreCouponTemplates() {
  const {data, error} = await nativeDb().from('store_coupon_templates').select('*').order('created_at', {ascending: false})
  if (error) throw error
  return data ?? []
}
export async function saveStoreCouponTemplate(input: {id?: string; title: string; thresholdCents: number; discountCents: number; validDays?: number | null; terms?: string | null; active: boolean; eligibleProductIds: string[]}, adminId: string) {
  const row = {title: input.title, threshold_cents: input.thresholdCents, discount_cents: input.discountCents, valid_days: input.validDays ?? null, terms: input.terms ?? null, active: input.active, eligible_product_ids: input.eligibleProductIds}
  const query = input.id ? nativeDb().from('store_coupon_templates').update(row).eq('id', input.id) : nativeDb().from('store_coupon_templates').insert({...row, created_by: adminId})
  const {data, error} = await query.select('*').single()
  if (error) throw new NativeStoreError('请检查优惠券门槛、金额、有效天数和使用条款', 'INVALID_COUPON_TEMPLATE', 400)
  return data
}
export async function listStoreCouponBatches() {
  const {data, error} = await nativeDb().from('store_coupon_batches').select('id,template_id,batch_key,created_by,created_at').order('created_at', {ascending: false}).limit(100)
  if (error) throw error
  return data ?? []
}
export async function grantStoreCouponBatch(input: {templateId: string; batchKey: string; userIds: string[]}, adminId: string) {
  return rpc<{batchId: string; grantedCount: number}>('grant_store_coupon_batch', {p_admin_id: adminId, p_template_id: input.templateId, p_batch_key: input.batchKey, p_user_ids: input.userIds})
}

export async function listCouponOffers(userId?: string) {
  if (userId) return rpc<Record<string, unknown>[]>('list_store_coupon_offers', {p_user_id: userId})
  const {data, error} = await nativeDb().from('store_coupon_offers').select('*').order('created_at')
  if (error) throw error
  return data ?? []
}
export async function getCouponExchange(userId: string, key: string) {
  const {data,error}=await nativeDb().from('store_coupon_exchanges').select('*').eq('user_id',userId).eq('intent_key',key).maybeSingle(); if(error) throw error; return data
}
export async function exchangeCoupon(userId: string, input: {offerId:string;expectedVersion:string;idempotencyKey:string}) {
  const {data,error}=await nativeDb().rpc('exchange_store_coupon',{p_user_id:userId,p_offer_id:input.offerId,p_expected_version:input.expectedVersion,p_intent_key:input.idempotencyKey})
  if(error){
    const failures: Record<string,[string,string]> = {offer_changed:['兑换价格或条款已变化，请重新确认','OFFER_CHANGED'],offer_unavailable:['该优惠券暂不可兑换','OFFER_UNAVAILABLE'],insufficient_coins:['硬币不足','INSUFFICIENT_COINS'],exchange_limit:['已达到兑换数量上限','EXCHANGE_LIMIT'],intent_conflict:['兑换标识已使用','INTENT_CONFLICT']}
    for(const [key,[message,code]] of Object.entries(failures)) if(error.message.includes(key)) throw new NativeStoreError(message,code,409)
    throw new Error('兑换结果暂未确认，请使用原兑换标识核查')
  }
  if(!data) throw new Error('兑换结果暂未确认')
  return data
}
export async function saveCouponOffer(input: {id?:string;templateId:string;coinPrice:number;totalLimit:number;perUserLimit:number;active:boolean;expectedVersion?:number}) {
  return rpc('save_store_coupon_offer',{p_input:input})
}
