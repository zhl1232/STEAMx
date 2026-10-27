import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StoreServiceError } from './service'
import { isStoreContextKey } from './external-channel'
import { decryptStoreAddress } from './address-crypto'

export type StoreAttempt = {
  id: string
  order_id: string
  attempt_reference: string
  provider: 'alipay' | 'wechat'
  amount_cents: number
  status: 'pending' | 'succeeded' | 'closed' | 'failed'
  created_at: string
}
export type StoreRefundAttempt = {
  id: string
  order_id: string
  aftersale_id: string
  attempt_no: number
  refund_reference: string
  provider: 'alipay' | 'wechat'
  amount_cents: number
  status: 'pending' | 'closed' | 'abnormal' | 'refunded'
}
export type StoreAftersale = {
  id: string
  order_id: string
  user_id: string
  status: string
  reason: string
  amount_cents: number
  kind: string
  provider: string | null
  provider_ref: string | null
  created_at: string
  refund_reference?: string | null
  refund_channel_status?: StoreRefundAttempt['status'] | null
  return_address_encrypted?: string | null
  carrier?: string | null
  tracking_number?: string | null
}
export type StorePrivateOrder = {
  id: string
  user_id: string
  status: string
  payment_status: string
  payment_provider: string | null
  payment_reference: string | null
  total_cents: number
  currency: string
  created_at: string
  address_snapshot_encrypted: string
}

function db(): SupabaseClient {
  if (!supabaseAdmin)
    throw new StoreServiceError(
      '商城服务暂不可用',
      'STORE_ADMIN_UNAVAILABLE',
      503,
    )
  return supabaseAdmin as unknown as SupabaseClient
}

export async function storeRpc<T>(
  name: string,
  parameters: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db().rpc(name, parameters)
  if (error) {
    // Do not expose database statements, address ciphertext or supplier details.
    throw new StoreServiceError(
      '订单状态已变化或操作条件不满足，请刷新后重试',
      'STORE_STATE_CONFLICT',
      409,
    )
  }
  return data as T
}

export async function getPrivateStoreOrder(
  id: string,
  userId?: string,
): Promise<StorePrivateOrder> {
  let query = db().from('store_orders').select('*').eq('id', id)
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new StoreServiceError('订单不存在', 'ORDER_NOT_FOUND', 404)
  return data as StorePrivateOrder
}

export async function getOrderAttempts(
  orderId: string,
): Promise<StoreAttempt[]> {
  const { data, error } = await db()
    .from('store_payment_attempts')
    .select(
      'id,order_id,attempt_reference,provider,amount_cents,status,created_at',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as StoreAttempt[]
}

export async function getAftersale(
  orderId: string,
): Promise<StoreAftersale | null> {
  const { data, error } = await db()
    .from('store_aftersales')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  if (error) throw error
  return data as StoreAftersale | null
}

export async function getRefundAttempt(orderId: string): Promise<StoreRefundAttempt> {
  return storeRpc<StoreRefundAttempt>('get_store_refund_attempt', { p_order_id: orderId })
}

/** Call only after verifying the caller owns this order. Never send raw rows. */
export async function getSafeOrderExtras(orderId: string) {
  const [shipment, aftersale, itemContexts] = await Promise.all([
    db()
      .from('store_shipments')
      .select('status,carrier,tracking_number,shipped_at,delivered_at')
      .eq('order_id', orderId)
      .maybeSingle(),
    getAftersale(orderId),
    db().from('store_order_items').select('metadata').eq('order_id', orderId),
  ])
  if (shipment.error) throw shipment.error
  let returnAddress: string | null = null
  if (aftersale?.return_address_encrypted)
    returnAddress = decryptStoreAddress(
      aftersale.return_address_encrypted,
    ).street
  return {
    learningLinks: [
      ...new Set(
        (itemContexts.data ?? []).flatMap((item) => {
          const keys: unknown = item.metadata?.contextKeys
          return Array.isArray(keys) ? keys.filter(isStoreContextKey) : []
        }),
      ),
    ].flatMap((key) => {
      const [kind, id] = key.split(':')
      if (kind === 'course')
        return [{ href: `/courses/${id}`, label: '返回配套课程' }]
      if (kind === 'project')
        return [{ href: `/project/${id}`, label: '返回配套项目' }]
      return []
    }),
    shipment: shipment.data,
    aftersale: aftersale
      ? {
          id: aftersale.id,
          status: aftersale.status,
          kind: aftersale.kind,
          reason: aftersale.reason,
          amount_cents: aftersale.amount_cents,
          created_at: aftersale.created_at,
          carrier: aftersale.carrier,
          tracking_number: aftersale.tracking_number,
          returnAddress,
          refundChannelStatus: aftersale.refund_channel_status ?? null,
        }
      : null,
  }
}

export async function listAdminStoreCatalog() {
  const { data, error } = await db()
    .from('store_products')
    .select(
      '*,variants:store_product_variants(*,sources:store_product_sources(id,source_url,source_price_cents,is_primary))',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data
}

export const ADMIN_STORE_ORDER_PAGE_SIZE = 100

export async function listAdminStoreOrders(page = 1, orderId?: string) {
  const safePage = !orderId && Number.isSafeInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1
  const from = (safePage - 1) * ADMIN_STORE_ORDER_PAGE_SIZE
  const to = from + ADMIN_STORE_ORDER_PAGE_SIZE
  let query = db()
    .from('store_orders')
    .select(
      'id,user_id,status,payment_status,payment_provider,total_cents,shipping_cents,created_at,items:store_order_items(id,title_snapshot,sku_snapshot,quantity,unit_price_cents),procurement:store_procurements(*),shipment:store_shipments(*),aftersale:store_aftersales(*)',
    )
  if (orderId) query = query.eq('id', orderId)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
  if (error) throw error
  // Return addresses remain encrypted until the individual authorized detail call.
  const rows = data ?? []
  const hasMore = rows.length > ADMIN_STORE_ORDER_PAGE_SIZE
  return {
    page: safePage,
    pageSize: ADMIN_STORE_ORDER_PAGE_SIZE,
    hasMore,
    orders: rows.slice(0, ADMIN_STORE_ORDER_PAGE_SIZE).map(({ aftersale, procurement, shipment, ...order }) => {
    const first = (value: unknown) =>
      Array.isArray(value) ? (value[0] ?? null) : value
    const privateAftersale = first(aftersale) as Record<string, unknown> | null
    const { return_address_encrypted: _private, ...safeAftersale } =
      privateAftersale || {}
    return {
      ...order,
      procurement: first(procurement),
      shipment: first(shipment),
      aftersale: privateAftersale ? { ...safeAftersale, refundChannelStatus: privateAftersale.refund_channel_status ?? null, refundReference: privateAftersale.refund_reference ?? null } : null,
    }
    }),
  }
}

export async function listReconcileWork() {
  const [attempts, refunds, reservations] = await Promise.all([
    db()
      .from('store_payment_attempts')
      .select(
        'id,order_id,attempt_reference,provider,amount_cents,status,created_at',
      )
      .eq('status', 'pending')
      .lte('reconcile_after', new Date().toISOString())
      .order('reconcile_after')
      .limit(20),
    db()
      .from('store_aftersales')
      .select('order_id')
      .eq('status', 'refund_pending')
      .lte('reconcile_after', new Date().toISOString())
      .order('reconcile_after')
      .limit(20),
    db()
      .from('store_inventory_reservations')
      .select('order_id')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .lte('reconcile_after', new Date().toISOString())
      .order('reconcile_after')
      .limit(20),
  ])
  for (const result of [attempts, refunds, reservations])
    if (result.error) throw result.error
  return {
    attempts: (attempts.data ?? []) as StoreAttempt[],
    refunds: refunds.data ?? [],
    expired: reservations.data ?? [],
  }
}

export async function scheduleNextReconcile(
  table:
    | 'store_payment_attempts'
    | 'store_aftersales'
    | 'store_inventory_reservations',
  orderId: string,
  failed = false,
) {
  const { error } = await db()
    .from(table)
    .update({
      reconcile_after: new Date(
        Date.now() + (failed ? 300_000 : 60_000),
      ).toISOString(),
      ...(table === 'store_aftersales'
        ? {}
        : table === 'store_payment_attempts'
          ? { failure_code: failed ? 'RECONCILIATION_PENDING' : null }
          : { last_reconcile_error: failed ? 'RECONCILIATION_PENDING' : null }),
    })
    .eq('order_id', orderId)
  if (error) throw error
  if (table === 'store_aftersales') {
    // Filter at write time: a concurrent callback can change the channel state
    // while scheduling. Never erase its manual-review reason or a final result.
    const { error: refundError } = await db()
      .from(table)
      .update({ last_reconcile_error: failed ? 'RECONCILIATION_PENDING' : null })
      .eq('order_id', orderId)
      .eq('status', 'refund_pending')
      .or('refund_channel_status.is.null,refund_channel_status.eq.pending')
    if (refundError) throw refundError
  }
}

export async function getReservationExpiry(orderId: string): Promise<string> {
  const { data, error } = await db()
    .from('store_inventory_reservations')
    .select('expires_at')
    .eq('order_id', orderId)
    .single()
  if (error || !data)
    throw new StoreServiceError('库存预留不存在', 'RESERVATION_NOT_FOUND', 409)
  return data.expires_at
}

export async function listPublicNativeProducts(productId?: string) {
  let query = db()
    .from('store_products')
    .select(
      'id,slug,name,description,cover_url,gallery_urls,detail_content,video_url,category,price_cents,shipping_cents,currency,fulfillment_description,blocked_provinces,context_keys,variants:store_product_variants(id,name,sku,price_cents,stock_quantity,stock_reserved,min_quantity,status)',
    )
    .eq('status', 'active')
    .eq('checkout_mode', 'internal')
    .not('shipping_cents', 'is', null)
  if (productId) query = query.eq('id', productId)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(48)
  if (error) throw error
  return (data ?? []).map((product) => ({
    ...product,
    variants: product.variants
      .filter((variant: { status: string }) => variant.status === 'active')
      .map(
        ({
          stock_reserved,
          ...variant
        }: {
          id: string
          name: string
          sku: string
          price_cents: number | null
          min_quantity: number
          status: string
          stock_reserved: number
          stock_quantity: number | null
        }) => ({
          ...variant,
          stock_quantity:
            variant.stock_quantity == null
              ? 0
              : Math.max(0, variant.stock_quantity - stock_reserved),
        }),
      ),
  }))
}

/** Administrator-only caller. Return display fields, never supplier or procurement data. */
export async function getAdminStoreProductPreview(productId: string) {
  const { data, error } = await db()
    .from('store_products')
    .select('id,name,description,cover_url,gallery_urls,detail_content,video_url,category,price_cents,shipping_cents,fulfillment_description,blocked_provinces,status,checkout_mode,variants:store_product_variants(id,name,price_cents,stock_quantity,stock_reserved,min_quantity,status)')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    status: data.status as string,
    checkoutMode: data.checkout_mode as string,
    product: {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | null,
      cover_url: data.cover_url as string | null,
      gallery_urls: (data.gallery_urls ?? []) as string[],
      detail_content: data.detail_content as string | null,
      video_url: data.video_url as string | null,
      category: data.category as string | null,
      price_cents: data.price_cents as number,
      shipping_cents: data.shipping_cents as number | null,
      fulfillment_description: data.fulfillment_description as string | null,
      blocked_provinces: (data.blocked_provinces ?? []) as string[],
      variants: (data.variants ?? []).map((variant: {
        id: string; name: string; price_cents: number | null; stock_quantity: number | null
        stock_reserved: number; min_quantity: number; status: string
      }) => ({
        id: variant.id,
        name: variant.name,
        price_cents: variant.price_cents,
        stock_quantity: variant.stock_quantity == null ? 0 : Math.max(0, variant.stock_quantity - variant.stock_reserved),
        stock_pending: variant.stock_quantity == null,
        min_quantity: variant.min_quantity,
        status: variant.status,
      })),
    },
  }
}

/** Private immutable sourcing evidence, exposed only by the admin order detail route. */
export async function getOrderProcurementSnapshot(orderId: string) {
  const {data, error} = await db().from('store_order_procurement_snapshots').select('snapshot,created_at').eq('order_id', orderId).maybeSingle()
  if (error) throw error
  return data
}
