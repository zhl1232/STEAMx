import type { ReactNode } from 'react'

import { requirePageUser } from '@/lib/auth/server'

export default async function ShopLayout({ children }: { children: ReactNode }) {
  await requirePageUser('/login?next=%2Fshop')

  return children
}
