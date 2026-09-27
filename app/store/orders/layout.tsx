import type { ReactNode } from 'react'
import { requirePageUser } from '@/lib/auth/server'
export default async function StoreOrdersLayout({ children }: { children: ReactNode }) {
  await requirePageUser()
  return children
}
