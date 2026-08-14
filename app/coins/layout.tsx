import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { requirePageUser } from '@/lib/auth/server'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CoinsLayout({ children }: { children: ReactNode }) {
  await requirePageUser()

  return children
}
