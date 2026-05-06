import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { requirePageUser } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageUser()

  return (
    <div className="min-h-screen bg-muted/30">
      {children}
    </div>
  );
}
