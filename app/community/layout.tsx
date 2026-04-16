"use client"

import { CommunityProvider } from '@/lib/context/community-context'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
    return (
        <CommunityProvider>
            {children}
        </CommunityProvider>
    )
}
