import { z } from 'zod'
import { ValidationError } from '@/lib/api/validation'
import { MAINLAND_PROVINCES } from './regions'
import { isStoreContextKey } from './external-channel'

const money = z.number().int().min(0).max(100_000_000)
const safeUrl = z.string().max(2048).refine(value => {
  if (!value) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}, '链接必须为 HTTPS')
const schema = z.object({
  version: z.number().int().nonnegative().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().trim().min(1).max(180), description: z.string().max(10000).nullish(),
  coverUrl: safeUrl.nullish(), priceCents: money.min(1), shippingCents: money,
  status: z.enum(['draft','active','archived']),
  fulfillmentDescription: z.string().trim().min(1).max(2000),
  blockedProvinces: z.array(z.enum(MAINLAND_PROVINCES)).max(31).default([]),
  contextKeys: z.array(z.string().refine(isStoreContextKey)).max(24).default([]),
  variants: z.array(z.object({
    id: z.uuid().optional(), version: z.number().int().nonnegative().optional(), name: z.string().trim().min(1).max(100), sku: z.string().trim().min(1).max(100),
    priceCents: money.min(1).nullable().optional(), stockQuantity: z.number().int().min(0).max(1_000_000),
    minQuantity: z.number().int().min(1).max(100).default(1),
    status: z.enum(['active','paused','archived']).default('active'), supplierUrl: safeUrl.nullish(), costCents: money.nullish(),
  })).min(1).max(50),
})
export function parseNativeCatalog(value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) throw new ValidationError(`商品信息有误：${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`)
  if (new Set(result.data.variants.map(v => v.sku)).size !== result.data.variants.length) throw new ValidationError('SKU 不能重复')
  return { ...result.data, description: result.data.description ?? undefined, coverUrl: result.data.coverUrl ?? undefined }
}

type CatalogRow = {
  id: string; catalog_version: number; slug: string; name: string; description: string | null; cover_url: string | null;
  price_cents: number; shipping_cents: number | null; status: string; fulfillment_description: string | null;
  context_keys: string[]; blocked_provinces: string[];
  variants: Array<{ id: string; catalog_version: number; name: string; sku: string; price_cents: number | null; stock_quantity: number | null; stock_reserved: number; min_quantity: number; status: string; sources: Array<{ is_primary: boolean; source_url: string | null; source_price_cents: number | null }> }>
}
export function mapAdminCatalog(row: CatalogRow) {
  return {
    id: row.id, version: row.catalog_version, slug: row.slug, name: row.name, description: row.description, coverUrl: row.cover_url,
    priceCents: row.price_cents, shippingCents: row.shipping_cents, status: row.status,
    fulfillmentDescription: row.fulfillment_description, contextKeys: row.context_keys, blockedProvinces: row.blocked_provinces,
    variants: row.variants.map(variant => {
      const source = variant.sources.find(item => item.is_primary)
      return { id: variant.id, version: variant.catalog_version, name: variant.name, sku: variant.sku, priceCents: variant.price_cents,
        stockQuantity: variant.stock_quantity, reservedQuantity: variant.stock_reserved, minQuantity: variant.min_quantity,
        status: variant.status, supplierUrl: source?.source_url ?? '', costCents: source?.source_price_cents ?? null }
    }),
  }
}
