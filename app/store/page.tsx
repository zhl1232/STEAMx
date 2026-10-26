import { notFound, redirect } from 'next/navigation'

import { StoreCatalogClient } from '@/components/store/store-catalog-client'
import { isStoreCatalogVisible } from '@/lib/store/config'

export const dynamic = 'force-dynamic'

export default async function StorePage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  if (!isStoreCatalogVisible()) notFound()
  const { product } = await searchParams
  if (product) redirect(`/store/products/${encodeURIComponent(product)}`)
  return <StoreCatalogClient />
}
