import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePageRole } from '@/lib/auth/server'
import { isStorePreviewEnabled } from '@/lib/store/config'
import { StorePreviewCheckout } from '@/components/admin/store-preview-checkout'

export const metadata: Metadata = { title: '商城支付预览', robots: { index: false, follow: false } }

export default async function StorePreviewPage() {
  await requirePageRole(['admin'])
  if (!isStorePreviewEnabled()) notFound()
  return <main className="min-h-screen bg-[hsl(var(--surface-sunken))] px-4 py-8"><StorePreviewCheckout /></main>
}
