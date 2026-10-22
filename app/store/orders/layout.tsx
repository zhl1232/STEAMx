import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requirePageUser } from '@/lib/auth/server'
import { buildSegmentTitle } from '@/lib/seo/title'

export const metadata: Metadata = {
  title: buildSegmentTitle('本站材料包订单'),
}

export default async function StoreOrdersLayout({ children }: { children: ReactNode }) {
  await requirePageUser()
  return children
}
