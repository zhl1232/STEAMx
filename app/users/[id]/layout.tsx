import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import { createClient } from '@/lib/supabase/server'

interface UserProfileLayoutProps {
    children: React.ReactNode
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: UserProfileLayoutProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params
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
        .single()

    const profile = data as ProfileMetadata | null;
    if (!profile) return { title: '用户未找到' }

    const previousImages = (await parent).openGraph?.images || []

    const title = `${profile.display_name || '匿名用户'} 的个人主页 | STEAM 探索`
    const description = profile.bio?.substring(0, 160) || '来看看这个有趣的灵魂吧，在 STEAM 探索里发现更多项目。'

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `/users/${id}`,
            siteName: 'STEAM 探索',
            images: [
                ...(profile.avatar_url ? [{ url: profile.avatar_url, width: 400, height: 400, alt: profile.display_name || '头像' }] : []),
                ...previousImages,
            ],
            type: 'profile',
        },
        twitter: {
            card: 'summary',
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
