import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { STEAM_PATHNAME_HEADER, isPublicSettingsPath } from '@/lib/auth/login-redirect'
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
  const pathname = (await headers()).get(STEAM_PATHNAME_HEADER) || '/settings'
  if (!isPublicSettingsPath(pathname)) {
    await requirePageUser()
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {children}
    </div>
  );
}
