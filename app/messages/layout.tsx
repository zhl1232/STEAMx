import type { ReactNode } from 'react'

import { requirePageUser } from '@/lib/auth/server'

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  await requirePageUser('/login')

  return children
}
