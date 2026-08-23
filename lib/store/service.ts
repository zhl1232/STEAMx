import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { encryptStoreAddress, maskRecipientName, phoneLast4, type StoreAddressPayload } from '@/lib/store/address-crypto'
import {
  isStoreContextKey,
  normalizeTaobaoUrl,
  type StoreCheckoutMode,
  type StoreExternalChannel,
} from '@/lib/store/external-channel'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

type StoreClient = SupabaseClient<Database, 'public'>
type ProductRow = Database['public']['Tables']['store_products']['Row']
type VariantRow = Database['public']['Tables']['store_product_variants']['Row']
type SourceRow = Database['public']['Tables']['store_product_sources']['Row']
type SupplierRow = Database['public']['Tables']['store_suppliers']['Row']
type OrderRow = Database['public']['Tables']['store_orders']['Row']
type OrderItemRow = Database['public']['Tables']['store_order_items']['Row']

export type PublicStoreOrderItem = Pick<OrderItemRow, 'id' | 'order_id' | 'title_snapshot' | 'sku_snapshot' | 'quantity' | 'unit_price_cents' | 'created_at'>

function mapPublicOrderItem(item: OrderItemRow): PublicStoreOrderItem {
  return {
    id: item.id,
    order_id: item.order_id,
    title_snapshot: item.title_snapshot,
    sku_snapshot: item.sku_snapshot,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    created_at: item.created_at,
  }
}

const SAFE_ORDER_COLUMNS = [
  'id', 'user_id', 'status', 'payment_status', 'payment_provider', 'payment_reference',
  'currency', 'subtotal_cents', 'shipping_cents', 'total_cents', 'external_order_id',
  'alibaba_order_id', 'alibaba_status', 'failure_code', 'failure_message', 'paid_at',
  'ordered_at', 'shipped_at', 'delivered_at', 'created_at', 'updated_at',
].join(', ')
const SAFE_ORDER_ITEM_COLUMNS = 'id, order_id, title_snapshot, sku_snapshot, quantity, unit_price_cents, created_at'

export class StoreServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 422,
  ) {
    super(message)
    this.name = 'StoreServiceError'
  }
}

function getAdminClient(): StoreClient {
  if (!supabaseAdmin) {
    throw new StoreServiceError('商城服务尚未配置数据库管理员密钥', 'STORE_ADMIN_UNAVAILABLE', 503)
  }
  return supabaseAdmin
}

export type StoreCatalogVariant = VariantRow & {
  source: (SourceRow & { supplier: SupplierRow | null }) | null
}

export type StoreCatalogProduct = ProductRow & {
  variants: StoreCatalogVariant[]
}

export type PublicStoreVariant = Pick<
  VariantRow,
  'id' | 'name' | 'sku' | 'price_cents' | 'min_quantity' | 'stock_quantity'
>

export type PublicStoreProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  cover_url: string | null
  currency: string
  price_cents: number
  compare_at_price_cents: number | null
  checkout_mode: StoreCheckoutMode
  external_channel: StoreExternalChannel | null
  external_url: string | null
  variants: PublicStoreVariant[]
}

type PublicProductFields = Pick<
  ProductRow,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'cover_url'
  | 'currency'
  | 'price_cents'
  | 'compare_at_price_cents'
  | 'checkout_mode'
  | 'external_channel'
  | 'external_url'
>

function mapPublicStoreProductFields(product: PublicProductFields, variants: PublicStoreVariant[]): PublicStoreProduct {
  const checkoutMode: StoreCheckoutMode = product.checkout_mode === 'external' ? 'external' : 'internal'
  const externalUrl = checkoutMode === 'external' ? normalizeTaobaoUrl(product.external_url) : null
  const externalChannel: StoreExternalChannel | null =
    checkoutMode === 'external' && product.external_channel === 'taobao' ? 'taobao' : null

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    cover_url: product.cover_url,
    currency: product.currency,
    price_cents: product.price_cents,
    compare_at_price_cents: product.compare_at_price_cents,
    checkout_mode: checkoutMode,
    external_channel: externalChannel,
    external_url: externalChannel ? externalUrl : null,
    variants,
  }
}

/**
 * Strip sourcing/metadata fields before a product reaches the browser and
 * normalize the configured Taobao URL defensively.
 */
export function mapPublicStoreProduct(product: StoreCatalogProduct): PublicStoreProduct {
  return mapPublicStoreProductFields(product, product.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price_cents: variant.price_cents,
    min_quantity: variant.min_quantity,
    stock_quantity: variant.stock_quantity,
  })))
}

export async function listStoreProducts(
  supabase: StoreClient,
  options: { limit?: number; search?: string } = {},
): Promise<StoreCatalogProduct[]> {
  const limit = Math.min(48, Math.max(1, options.limit ?? 24))
  let query = supabase
    .from('store_products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.search?.trim()) query = query.ilike('name', `%${options.search.trim()}%`)
  const { data: products, error: productsError } = await query
  if (productsError) throw productsError
  if (!products?.length) return []

  const productIds = products.map((product) => product.id)
  const { data: variants, error: variantsError } = await supabase
    .from('store_product_variants')
    .select('*')
    .in('product_id', productIds)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (variantsError) throw variantsError
  if (!variants?.length) return products.map((product) => ({ ...product, variants: [] }))

  const variantIds = variants.map((variant) => variant.id)
  const { data: sources, error: sourcesError } = await supabase
    .from('store_product_sources')
    .select('*')
    .in('variant_id', variantIds)
    .eq('is_primary', true)
  if (sourcesError) throw sourcesError

  const supplierIds = [...new Set((sources ?? []).map((source) => source.supplier_id))]
  const { data: suppliers, error: suppliersError } = supplierIds.length
    ? await supabase.from('store_suppliers').select('*').in('id', supplierIds)
    : { data: [], error: null }
  if (suppliersError) throw suppliersError

  const sourceByVariant = new Map<string, SourceRow>(
    (sources ?? []).map((source) => [source.variant_id, source]),
  )
  const supplierById = new Map<string, SupplierRow>((suppliers ?? []).map((supplier) => [supplier.id, supplier]))
  const variantsByProduct = new Map<string, StoreCatalogVariant[]>()
  for (const variant of variants) {
    const source = sourceByVariant.get(variant.id)
    const enriched = {
      ...variant,
      source: source ? { ...source, supplier: supplierById.get(source.supplier_id) ?? null } : null,
    }
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push(enriched)
    variantsByProduct.set(variant.product_id, list)
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? [],
  }))
}

/**
 * Read only the active Taobao products associated with a course/lesson/project.
 * This deliberately avoids the source/supplier tables because a contextual
 * recommendation needs no procurement details.
 */
export async function listStoreProductsForContext(
  supabase: StoreClient,
  contextKey: string,
  options: { limit?: number } = {},
): Promise<PublicStoreProduct[]> {
  if (!isStoreContextKey(contextKey)) return []

  try {
    const limit = Math.min(6, Math.max(1, options.limit ?? 3))
    const { data: products, error: productsError } = await supabase
      .from('store_products')
      .select('id, slug, name, description, cover_url, currency, price_cents, compare_at_price_cents, checkout_mode, external_channel, external_url, context_keys')
      .eq('status', 'active')
      .eq('checkout_mode', 'external')
      .eq('external_channel', 'taobao')
      .contains('context_keys', [contextKey])
      .order('created_at', { ascending: false })
      .limit(48)
    if (productsError) throw productsError

    const matched = (products ?? []).slice(0, limit)
    if (!matched.length) return []

    const { data: variants, error: variantsError } = await supabase
      .from('store_product_variants')
      .select('id, product_id, name, sku, price_cents, min_quantity, stock_quantity')
      .in('product_id', matched.map((product) => product.id))
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (variantsError) throw variantsError

    const variantsByProduct = new Map<string, PublicStoreVariant[]>()
    for (const variant of variants ?? []) {
      const list = variantsByProduct.get(variant.product_id) ?? []
      list.push({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price_cents: variant.price_cents,
        min_quantity: variant.min_quantity,
        stock_quantity: variant.stock_quantity,
      })
      variantsByProduct.set(variant.product_id, list)
    }

    return matched.map((product) => mapPublicStoreProductFields(
      product,
      variantsByProduct.get(product.id) ?? [],
    ))
  } catch (error) {
    // 商品推荐不是课程/项目页面的硬依赖；迁移尚未执行或目录暂时不可用时，
    // 隐藏卡片但不要阻断学习内容。
    logger.warn('Contextual store products unavailable', {
      contextKey,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export type StoreCheckoutItemInput = {
  variantId: string
  quantity: number
}

export type StoreCheckoutLine = {
  product: ProductRow
  variant: VariantRow
  source: SourceRow
  supplier: SupplierRow
  quantity: number
  unitPriceCents: number
}

export type StoreCheckoutQuote = {
  lines: StoreCheckoutLine[]
  supplier: SupplierRow
  subtotalCents: number
  shippingCents: number
  totalCents: number
}

export async function quoteStoreCheckout(
  supabase: StoreClient,
  input: StoreCheckoutItemInput[],
): Promise<StoreCheckoutQuote> {
  const merged = new Map<string, number>()
  for (const item of input) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
      throw new StoreServiceError('购买数量必须是 1 到 100 的整数', 'INVALID_QUANTITY')
    }
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity)
  }
  if (!merged.size) throw new StoreServiceError('请至少选择一件商品', 'EMPTY_CART')

  const variantIds = [...merged.keys()]
  const { data: variants, error: variantsError } = await supabase
    .from('store_product_variants')
    .select('*')
    .in('id', variantIds)
    .eq('status', 'active')
  if (variantsError) throw variantsError
  if (!variants || variants.length !== variantIds.length) {
    throw new StoreServiceError('部分商品已下架，请刷新购物车', 'VARIANT_UNAVAILABLE')
  }

  const productIds = [...new Set(variants.map((variant) => variant.product_id))]
  const { data: products, error: productsError } = await supabase
    .from('store_products')
    .select('*')
    .in('id', productIds)
    .eq('status', 'active')
  if (productsError) throw productsError
  const productById = new Map<string, ProductRow>((products ?? []).map((product) => [product.id, product]))

  const { data: sources, error: sourcesError } = await supabase
    .from('store_product_sources')
    .select('*')
    .in('variant_id', variantIds)
    .eq('is_primary', true)
  if (sourcesError) throw sourcesError
  const sourceByVariant = new Map<string, SourceRow>((sources ?? []).map((source) => [source.variant_id, source]))
  const supplierIds = [...new Set((sources ?? []).map((source) => source.supplier_id))]
  const { data: suppliers, error: suppliersError } = supplierIds.length
    ? await supabase.from('store_suppliers').select('*').in('id', supplierIds).eq('status', 'active')
    : { data: [], error: null }
  if (suppliersError) throw suppliersError
  const supplierById = new Map<string, SupplierRow>((suppliers ?? []).map((supplier) => [supplier.id, supplier]))

  const lines: StoreCheckoutLine[] = []
  for (const variant of variants) {
    const product = productById.get(variant.product_id)
    if (!product) {
      throw new StoreServiceError('部分商品暂时无法采购，请稍后再试', 'SOURCE_UNAVAILABLE')
    }
    if (product.checkout_mode === 'external') {
      throw new StoreServiceError('该商品请前往淘宝完成购买', 'EXTERNAL_CHECKOUT_REQUIRED', 409)
    }
    const source = sourceByVariant.get(variant.id)
    const supplier = source ? supplierById.get(source.supplier_id) : undefined
    if (!source || !supplier) {
      throw new StoreServiceError('部分商品暂时无法采购，请稍后再试', 'SOURCE_UNAVAILABLE')
    }
    if (!supplier.supports_drop_ship) {
      throw new StoreServiceError(`供应商「${supplier.name}」尚未开通代发`, 'SUPPLIER_NOT_DROP_SHIP')
    }

    const quantity = merged.get(variant.id) ?? 0
    const minimum = Math.max(variant.min_quantity, source.source_min_quantity ?? 1)
    if (quantity < minimum) {
      throw new StoreServiceError(`「${variant.name}」起订量为 ${minimum}`, 'MOQ_NOT_MET')
    }
    const stock = source.source_stock_quantity ?? variant.stock_quantity
    if (stock !== null && quantity > stock) {
      throw new StoreServiceError(`「${variant.name}」库存不足`, 'INSUFFICIENT_STOCK')
    }
    const productQuantity = variants
      .filter((candidate) => candidate.product_id === product.id)
      .reduce((sum, candidate) => sum + (merged.get(candidate.id) ?? 0), 0)
    if (product.stock_quantity !== null && productQuantity > product.stock_quantity) {
      throw new StoreServiceError(`「${product.name}」库存不足`, 'INSUFFICIENT_STOCK')
    }
    lines.push({
      product,
      variant,
      source,
      supplier,
      quantity,
      unitPriceCents: variant.price_cents ?? product.price_cents,
    })
  }

  const supplierSet = new Set(lines.map((line) => line.supplier.id))
  if (supplierSet.size !== 1) {
    throw new StoreServiceError('不同供应商的商品需要分开结算', 'MULTIPLE_SUPPLIERS')
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  const shippingCents = 0
  return {
    lines,
    supplier: lines[0].supplier,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  }
}

export type CreateStoreOrderInput = {
  userId: string
  idempotencyKey?: string
  items: StoreCheckoutItemInput[]
  address: StoreAddressPayload
}

export async function createStoreOrder(input: CreateStoreOrderInput) {
  const admin = getAdminClient()
  const idempotencyKey = input.idempotencyKey?.trim() || `store-${randomUUID()}`
  const existing = await admin
    .from('store_orders')
    .select('id, status, payment_status, total_cents')
    .eq('user_id', input.userId)
    .eq('external_order_id', idempotencyKey)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data

  const quote = await quoteStoreCheckout(admin, input.items)
  let encryptedAddress: string
  try {
    encryptedAddress = encryptStoreAddress(input.address)
  } catch {
    throw new StoreServiceError(
      '商城地址加密密钥尚未配置，暂时无法创建订单',
      'STORE_ADDRESS_ENCRYPTION_UNAVAILABLE',
      503,
    )
  }
  const { data: address, error: addressError } = await admin
    .from('store_addresses')
    .insert({
      user_id: input.userId,
      label: '收货地址',
      recipient_name_masked: maskRecipientName(input.address.recipientName),
      phone_last4: phoneLast4(input.address.phone),
      payload_encrypted: encryptedAddress,
      is_default: false,
    })
    .select('id')
    .single()
  if (addressError || !address) throw addressError || new Error('Failed to save store address')

  const items = quote.lines.map((line) => ({
    product_id: line.product.id,
    variant_id: line.variant.id,
    supplier_id: line.supplier.id,
    title_snapshot: line.product.name,
    sku_snapshot: line.variant.sku,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
    offer_id: line.source.offer_id,
    spec_id: line.source.spec_id,
    metadata: { variantName: line.variant.name },
  }))
  const { data: orderId, error: orderError } = await admin.rpc('create_store_order', {
    p_user_id: input.userId,
    p_external_order_id: idempotencyKey,
    p_address_id: address.id,
    p_address_snapshot_encrypted: encryptedAddress,
    p_subtotal_cents: quote.subtotalCents,
    p_shipping_cents: quote.shippingCents,
    p_total_cents: quote.totalCents,
    p_items: items as unknown as Json,
  })
  if (orderError || !orderId) {
    await admin.from('store_addresses').delete().eq('id', address.id)
    throw orderError || new Error('Failed to create store order')
  }

  const { data: persisted, error: persistedError } = await admin
    .from('store_orders')
    .select('id, address_id, status, payment_status, total_cents')
    .eq('id', orderId)
    .single()
  if (persistedError || !persisted) throw persistedError || new Error('Failed to load store order')
  if (persisted.address_id !== address.id) {
    // 并发幂等请求已经创建了同一订单，清理本次竞争中留下的地址行。
    await admin.from('store_addresses').delete().eq('id', address.id)
    return {
      id: persisted.id,
      status: persisted.status,
      payment_status: persisted.payment_status,
      total_cents: persisted.total_cents,
      supplier: quote.supplier,
    }
  }

  return {
    id: orderId,
    status: 'pending_payment',
    payment_status: 'unpaid',
    total_cents: quote.totalCents,
    supplier: quote.supplier,
  }
}

export async function markStoreOrderPaid(orderId: string, provider: string, reference: string) {
  const admin = getAdminClient()
  const { data, error } = await admin.rpc('mark_store_order_paid', {
    p_order_id: orderId,
    p_provider: provider,
    p_reference: reference,
  })
  if (error) throw error
  return Boolean(data)
}

export async function getUserStoreOrder(supabase: StoreClient, userId: string, orderId: string) {
  const { data: order, error } = await supabase
    .from('store_orders')
    .select(SAFE_ORDER_COLUMNS)
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!order) return null
  const safeOrder = order as unknown as Omit<OrderRow, 'address_snapshot_encrypted' | 'address_id'>

  const { data: items, error: itemsError } = await supabase
    .from('store_order_items')
    .select(SAFE_ORDER_ITEM_COLUMNS)
    .eq('order_id', safeOrder.id)
    .order('created_at', { ascending: true })
  if (itemsError) throw itemsError

  const { data: events, error: eventsError } = await supabase
    .from('store_order_events')
    .select('id, event_type, message, created_at')
    .eq('order_id', safeOrder.id)
    .order('created_at', { ascending: true })
  if (eventsError) throw eventsError

  return { ...safeOrder, items: (items as unknown as OrderItemRow[] ?? []).map(mapPublicOrderItem), events: events ?? [] }
}

export type StoreOrderWithItems = Omit<OrderRow, 'address_snapshot_encrypted' | 'address_id'> & { items: PublicStoreOrderItem[] }

export async function listUserStoreOrders(supabase: StoreClient, userId: string): Promise<StoreOrderWithItems[]> {
  const { data: orders, error } = await supabase
    .from('store_orders')
    .select(SAFE_ORDER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  if (!orders?.length) return []
  const safeOrders = orders as unknown as StoreOrderWithItems[]
  const { data: items, error: itemsError } = await supabase
    .from('store_order_items')
    .select(SAFE_ORDER_ITEM_COLUMNS)
    .in('order_id', safeOrders.map((order) => order.id))
  if (itemsError) throw itemsError
  const itemsByOrder = new Map<string, PublicStoreOrderItem[]>()
  for (const item of (items as unknown as OrderItemRow[] ?? [])) {
    const list = itemsByOrder.get(item.order_id) ?? []
    list.push(mapPublicOrderItem(item))
    itemsByOrder.set(item.order_id, list)
  }
  return safeOrders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }))
}
