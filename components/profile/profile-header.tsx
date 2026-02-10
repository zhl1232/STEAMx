"use client";

import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, Zap, ChevronRight } from "lucide-react";
import { LevelProgress } from "@/components/features/gamification/level-progress";
import { BadgeGalleryDialog } from "@/components/features/gamification/badge-gallery-dialog";
import { EditProfileDialog } from "@/components/features/profile/edit-profile-dialog";
import { useGamification, BADGES } from "@/context/gamification-context";
import { Profile } from "@/lib/mappers/types";
import { User } from "@supabase/supabase-js";

interface ProfileHeaderProps {
    user: User;
    profile: Profile | null;
    myProjectsCount: number;
    likedProjectsCount: number;
    collectedProjectsCount: number;
    totalLikesReceived: number;
    followerCount: number;
    followingCount: number;
}

export function ProfileHeader({
    user,
    profile,
    myProjectsCount,
    likedProjectsCount: _likedProjectsCount,
    collectedProjectsCount: _collectedProjectsCount,
    totalLikesReceived,
    followerCount,
    followingCount,
}: ProfileHeaderProps) {
    const { unlockedBadges } = useGamification();
    
    // Derived state
    const userName = profile?.display_name || user.user_metadata?.full_name || '未命名用户';
    const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;
    const currentXP = profile?.xp || 0;
    const level = Math.floor(Math.sqrt(currentXP / 100)) + 1;
    const nextLevelXP = 100 * Math.pow(level, 2);

    return (
        <>
            {/* 1. Cover Image Area */}
            <div className="relative h-32 w-full overflow-hidden">
                <OptimizedImage
                    src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2000&auto=format&fit=crop"
                    alt="Cover"
                    fill
                    variant="cover"
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />

                {/* Settings Button on Cover */}
                <div className="absolute top-4 right-4 text-white z-10">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/20 text-white">
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* 2. Main Profile Content */}
            <div className="relative px-5 -mt-12 mb-4">
                <div className="flex justify-between items-end mb-3">
                    {/* Avatar (Overlapping) */}
                    <div className="relative">
                        {userAvatar ? (
                            <OptimizedImage
                                src={userAvatar}
                                alt={userName}
                                width={96}
                                height={96}
                                variant="avatar"
                                className="rounded-full border-4 border-background shadow-lg object-cover bg-background"
                            />
                        ) : (
                            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-lg border-4 border-background">
                                {userName[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-green-500 border-[3px] border-background" />
                    </div>

                    {/* Edit profile */}
                    <div className="mb-2 flex items-center gap-2">
                        <EditProfileDialog>
                            <Button variant="outline" size="sm" className="rounded-full px-6 font-medium shadow-sm active:scale-95 transition-transform h-9">
                                编辑资料
                            </Button>
                        </EditProfileDialog>
                    </div>
                </div>

                {/* User Stats & Info Combined Row */}
                <div className="flex justify-between items-start mt-1 mb-6">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold text-foreground leading-tight truncate">{userName}</h1>
                            <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm shrink-0">
                                <Zap className="h-3 w-3 fill-current" />
                                Lv.{level}
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{user.email}</p>
                        {profile?.bio && <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{profile.bio}</p>}
                    </div>

                    {/* Compact Stats Row */}
                    <div className="flex items-center gap-4 shrink-0 pt-2">
                        <div className="text-center cursor-pointer group">
                            <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{myProjectsCount}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">作品</div>
                        </div>
                        <div className="text-center cursor-pointer group">
                             <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{followerCount}</div>
                             <div className="text-[10px] text-muted-foreground font-medium">粉丝</div>
                        </div>
                        <div className="text-center cursor-pointer group">
                             <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{followingCount}</div>
                             <div className="text-[10px] text-muted-foreground font-medium">关注</div>
                        </div>
                        <div className="text-center cursor-pointer group">
                            <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{totalLikesReceived}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">获赞</div>
                        </div>
                    </div>
                </div>

                {/* Level & Badges Area (Combined) */}
                <div className="bg-muted/30 rounded-2xl p-4 border space-y-4">
                    {/* Level Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">当前等级进度</span>
                            <span className="text-xs font-bold text-primary">{currentXP}/{nextLevelXP}</span>
                        </div>
                        <LevelProgress showLabel={false} className="h-1.5 bg-muted" />
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* Badges */}
                    <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges}>
                        <div className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">成就徽章</span>
                                <span className="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                                    {unlockedBadges.size}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                                <div className="flex -space-x-1.5">
                                    {(unlockedBadges.size > 0
                                        ? BADGES.filter(b => unlockedBadges.has(b.id)).slice(0, 4)
                                        : BADGES.slice(0, 4)
                                    ).map(b => (
                                        <div key={b.id} className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-xs shadow-sm">
                                            {b.icon}
                                        </div>
                                    ))}
                                </div>
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </div>
                        </div>
                    </BadgeGalleryDialog>
                </div>
            </div>
        </>
    );
}
