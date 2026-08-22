import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { requirePageUser } from '@/lib/auth/server'

export const metadata: Metadata = {
  title: '材料包商城',
  robots: { index: false, follow: false },
}

export default async function StoreLayout({ children }: { children: ReactNode }) {
  await requirePageUser()
  return children
}
