import type { ReactNode } from 'react'
import { requirePageUser } from '@/lib/auth/server'
export const metadata = { title: '我的优惠券', robots: { index: false, follow: false } }
export default async function CouponsLayout({ children }: { children: ReactNode }) {
  await requirePageUser()
  return children
}
