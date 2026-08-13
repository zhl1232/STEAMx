import React from 'react'
import { Metadata } from 'next'
import { isUuid } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

interface UserProfileLayoutProps {
    children: React.ReactNode
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: UserProfileLayoutProps
): Promise<Metadata> {
    const { id } = await params
    if (!isUuid(id)) {
        return { title: '用户未找到', robots: { index: false, follow: false } }
    }

    const supabase = await createClient()

    interface ProfileMetadata {
        display_name: string | null;
        bio: string | null;
        avatar_url: string | null;
    }

    const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("id", id)
        .maybeSingle()

    const profile = data as ProfileMetadata | null;
    if (!profile) return { title: '用户未找到', robots: { index: false, follow: false } }

    const displayName = profile.display_name || '匿名用户'
    const title = `${displayName} 的个人主页`
    const description = profile.bio?.substring(0, 160) || '来看看这个有趣的灵魂吧，在 STEAM 探索里发现更多项目。'

    return {
        title,
        description,
        keywords: [displayName, '用户主页', 'STEAM 社区'],
        alternates: {
            canonical: `/users/${id}`,
        },
        openGraph: {
            title,
            description,
            url: `/users/${id}`,
            siteName: 'STEAM 探索',
            ...(profile.avatar_url
                ? {
                    images: [{ url: profile.avatar_url, width: 400, height: 400, alt: profile.display_name || '头像' }],
                }
                : {}),
            type: 'profile',
        },
        twitter: {
            card: profile.avatar_url ? 'summary_large_image' : 'summary',
            title,
            description,
            images: profile.avatar_url ? [profile.avatar_url] : [],
        },
    }
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
        </>
    )
}
