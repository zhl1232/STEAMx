import { notFound } from 'next/navigation'

import { StoreCatalogClient } from '@/components/store/store-catalog-client'
import { isStoreCatalogVisible } from '@/lib/store/config'

export const dynamic = 'force-dynamic'

export default function StorePage() {
  if (!isStoreCatalogVisible()) notFound()
  return <StoreCatalogClient />
}
