import type { ReactNode } from 'react'

import { requirePageRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole(['moderator', 'admin'])

  return children
}
