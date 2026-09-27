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
    const orderId = await rpc<string>('create_store_native_order', {
      p_user_id: input.userId,
      p_external_order_id: key,
      p_address_id: address.id,
      p_address_snapshot_encrypted: encrypted,
      p_province: input.province,
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
  shippingCents: number
  source?: 'manual' | '1688'
  description?: string
  coverUrl?: string
  blockedProvinces?: string[]
  createdBy?: string | null
}

export type NativeVariantAdminInput = {
  version?: number
  id?: string
  name: string
  sku: string
  priceCents?: number | null
  stockQuantity: number
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
