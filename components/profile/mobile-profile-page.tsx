"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Project } from "@/lib/types";
import { ProjectCard } from "@/components/features/project-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, PenBox, ChevronRight, Zap, Award } from "lucide-react";
import { LevelProgress } from "@/components/features/gamification/level-progress";
import { BadgeGalleryDialog } from "@/components/features/gamification/badge-gallery-dialog";
import { Badge } from "@/components/ui/badge";
import { mapProject } from "@/lib/mappers/project";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useProjects } from "@/context/project-context";
import { useGamification, BADGES } from "@/context/gamification-context";
import { EditProfileDialog } from "@/components/features/profile/edit-profile-dialog";

interface MobileProfilePageProps {
  user: any;
  profile: any;
  myProjects: Project[];
  likedProjectsList: Project[];
  collectedProjectsList: Project[];
  completedProjectsList: Project[];
}

export function MobileProfilePage({
  user,
  profile,
  myProjects,
  likedProjectsList,
  collectedProjectsList,
  completedProjectsList,
}: MobileProfilePageProps) {
  const { unlockedBadges } = useGamification();
  const userName = profile?.display_name || user.user_metadata?.full_name || '未命名用户';
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;

  const [activeTab, setActiveTab] = useState("works");

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      
      {/* 1. Cover Image Area */}
      <div className="relative h-32 w-full overflow-hidden">
         <Image 
            src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2000&auto=format&fit=crop"
            alt="Cover"
            fill
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
                    <Image
                    src={userAvatar}
                    alt={userName}
                    width={96}
                    height={96}
                    className="rounded-full border-4 border-background shadow-lg object-cover bg-background"
                    />
                ) : (
                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-lg border-4 border-background">
                    {userName[0].toUpperCase()}
                    </div>
                )}
                 <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-green-500 border-[3px] border-background" />
            </div>

             {/* Edit Button */}
            <div className="mb-2">
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
                        Lv.{Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1}
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{user.email}</p>
                 {profile?.bio && <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{profile.bio}</p>}
            </div>

            {/* Compact Stats Row */}
            <div className="flex items-center gap-5 shrink-0 pt-2">
                <div className="text-center cursor-pointer group">
                    <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{myProjects.length}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">作品</div>
                </div>
                <div className="text-center cursor-pointer group">
                    <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{collectedProjectsList.length}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">收藏</div>
                </div>
                <div className="text-center cursor-pointer group">
                    <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{myProjects.reduce((acc, p) => acc + p.likes, 0)}</div>
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
                        <span className="text-xs font-bold text-primary">{profile?.xp || 0} XP</span>
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

      {/* Tabs Content */}
      <Tabs defaultValue="works" className="w-full flex-1" onValueChange={setActiveTab}>
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4">
            <TabsList className="w-full h-11 bg-transparent p-0 justify-start gap-6">
                <TabsTrigger 
                    value="works" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                    作品 <span className="ml-1 text-xs text-muted-foreground">{myProjects.length}</span>
                </TabsTrigger>
                <TabsTrigger 
                    value="likes" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                    喜欢 <span className="ml-1 text-xs text-muted-foreground">{likedProjectsList.length}</span>
                </TabsTrigger>
                 <TabsTrigger 
                    value="completed" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                    完成 <span className="ml-1 text-xs text-muted-foreground">{completedProjectsList.length}</span>
                </TabsTrigger>
            </TabsList>
        </div>

        <div className="px-4 py-4 min-h-[300px]">
            <TabsContent value="works" className="mt-0 space-y-4">
                {myProjects.length === 0 ? (
                    <EmptyState 
                        icon={<PenBox className="h-10 w-10" />}
                        title="暂无作品" 
                        desc="分享你的第一个创意作品" 
                        btnText="去分享"
                        href="/share"
                    />
                ) : (
                   myProjects.map(p => <MobileProjectItem key={p.id} project={p} />)
                )}
            </TabsContent>
            <TabsContent value="likes" className="mt-0 space-y-4">
                 {likedProjectsList.length === 0 ? (
                    <EmptyState 
                        title="暂无喜欢" 
                        desc="去发现更多有趣的项目" 
                        btnText="去探索"
                        href="/explore"
                    />
                ) : (
                   likedProjectsList.map(p => <MobileProjectItem key={p.id} project={p} />)
                )}
            </TabsContent>
            <TabsContent value="completed" className="mt-0 space-y-4">
                  {completedProjectsList.length === 0 ? (
                    <EmptyState 
                        title="暂无完成" 
                        desc="动手完成一个项目吧" 
                        btnText="去探索"
                        href="/explore"
                    />
                ) : (
                   completedProjectsList.map(p => <MobileProjectItem key={p.id} project={p} />)
                )}
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function MobileProjectItem({ project }: { project: Project }) {
    return (
        <Link href={`/project/${project.id}`} className="flex gap-3 p-3 bg-card rounded-xl border shadow-sm">
            <div className="w-24 h-24 shrink-0 bg-muted rounded-lg overflow-hidden relative">
                 <Image
                    src={project.image || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop'}
                    alt={project.title}
                    fill
                    className="object-cover"
                />
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                    <h3 className="font-bold line-clamp-1">{project.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{project.description}</p>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>❤️ {project.likes}</span>
                    <span>👀 {(project as any).views || 0}</span>
                </div>
            </div>
        </Link>
    )
}

function EmptyState({ icon, title, desc, btnText, href }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                {icon || <Settings className="h-8 w-8" />}
            </div>
            <h3 className="font-bold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{desc}</p>
            <Link href={href}>
                <Button variant="outline" className="rounded-full px-8">{btnText}</Button>
            </Link>
        </div>
    )
}
