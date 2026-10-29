import { getKitsForVariants } from '@/lib/kits/service'
import { notFound } from 'next/navigation'
import { isStoreCatalogVisible, isStoreCheckoutEnabled } from '@/lib/store/config'
import { isUuid } from '@/lib/store/http'
import { listPublicNativeProducts } from '@/lib/store/operations'
import { StoreProductDetail } from '@/components/store/store-product-detail'
import type { StoreProduct } from '@/components/store/store-catalog-client'
export const dynamic = 'force-dynamic'
export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ variant?: string | string[] }> }) {
  const { id } = await params
  if (!isStoreCatalogVisible() || !isUuid(id)) notFound()
  const [product] = await listPublicNativeProducts(id)
  if (!product) notFound()
  const kits = await getKitsForVariants(product.variants.map(v => v.id))
  const detailedProduct = { ...product, variants: product.variants.map(v => ({ ...v, kit: kits[v.id] })) }
  const { variant } = await searchParams
  const requestedVariantId = typeof variant === 'string' ? variant : variant ? '__invalid__' : undefined
  return <StoreProductDetail key={`${id}:${requestedVariantId ?? ''}`} requestedVariantId={requestedVariantId} product={detailedProduct as StoreProduct} checkoutEnabled={isStoreCheckoutEnabled()} />
}
