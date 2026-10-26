import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StoreProductDetail } from '@/components/store/store-product-detail'
import { requirePageRole } from '@/lib/auth/server'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { isUuid } from '@/lib/store/http'
import { getAdminStoreProductPreview } from '@/lib/store/operations'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '管理员商品预览',
  robots: { index: false, follow: false },
}

export default async function AdminStoreProductPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(['admin'])
  const { id } = await params
  if (!isUuid(id)) notFound()
  const result = await getAdminStoreProductPreview(id)
  if (!result) notFound()
  const publicProductHref = isStoreCatalogVisible() && result.status === 'active'
    && result.checkoutMode === 'internal' && result.product.shipping_cents !== null
    ? `/store/products/${id}` : undefined
  return <StoreProductDetail product={result.product} checkoutEnabled={false} preview={{ status: result.status, publicProductHref }} />
}
