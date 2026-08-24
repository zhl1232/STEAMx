import React from 'react'
import { Metadata } from 'next'
import { isUuid } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { BRAND_FULL_NAME } from '@/lib/brand'
import { DEFAULT_SOCIAL_IMAGE } from '@/lib/seo/metadata'

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
    const description = profile.bio?.substring(0, 160) || `来看看这个有趣的灵魂吧，在${BRAND_FULL_NAME}里发现更多项目。`

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
            siteName: BRAND_FULL_NAME,
            images: [{
                url: profile.avatar_url || DEFAULT_SOCIAL_IMAGE,
                ...(profile.avatar_url ? { width: 400, height: 400 } : { width: 1200, height: 630 }),
                alt: profile.display_name || '头像',
            }],
            type: 'profile',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [profile.avatar_url || DEFAULT_SOCIAL_IMAGE],
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
