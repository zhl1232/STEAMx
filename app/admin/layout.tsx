import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { requirePageRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole(['moderator', 'admin'])

  return children
}
