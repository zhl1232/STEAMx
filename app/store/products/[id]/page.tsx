import { notFound } from 'next/navigation'
import { isStoreCatalogVisible, isStoreCheckoutEnabled } from '@/lib/store/config'
import { isUuid } from '@/lib/store/http'
import { listPublicNativeProducts } from '@/lib/store/operations'
import { StoreProductDetail } from '@/components/store/store-product-detail'
import type { StoreProduct } from '@/components/store/store-catalog-client'
export const dynamic = 'force-dynamic'
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isStoreCatalogVisible() || !isUuid(id)) notFound()
  const [product] = await listPublicNativeProducts(id)
  if (!product) notFound()
  return <StoreProductDetail product={product as StoreProduct} checkoutEnabled={isStoreCheckoutEnabled()} />
}
