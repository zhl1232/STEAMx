"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/lib/types";
import { mapProject, DbProject } from "@/lib/mappers/project";
import { ProfileSkeleton } from "@/components/features/profile/profile-skeleton";
import { ProjectCard } from "@/components/features/project-card";
import { FollowButton } from "@/components/features/social/follow-button";
import { useFollow } from "@/hooks/use-follow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BADGES } from "@/context/gamification-context";

interface PublicProfile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    xp: number;
    created_at: string;
}

export default function PublicProfilePage() {
    const params = useParams();
    const userId = params.id as string;
    const { user: currentUser } = useAuth();
    const [supabase] = useState(() => createClient());
    
    // Leverage React Query via useFollow hook for follower count and follow status
    const { followerCount } = useFollow(userId);

    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // followerCount is now from hook
    const [followingCount, setFollowingCount] = useState(0);
    const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!userId) return;
            setIsLoading(true);

            try {
                // 1. Fetch Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (profileError) throw profileError;
                setProfile(profileData);

                // 2. Fetch Projects
                const { data: projectsData } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('author_id', userId)
                    .order('created_at', { ascending: false });
                
                if (projectsData) {
                    setProjects(projectsData.map(p => mapProject(p as DbProject, (profileData as any)?.display_name || undefined)));
                }

                if (projectsData) {
                    setProjects(projectsData.map(p => mapProject(p as DbProject, (profileData as any)?.display_name || undefined)));
                }

                // 3. Fetch Follow Stats
                // followerCount is fetched by useFollow hook now
                
                const { count: following } = await supabase
                    .from('follows')
                    .select('following_id', { count: 'exact', head: true })
                    .eq('follower_id', userId);
                setFollowingCount(following || 0);

                // 4. Fetch Badges
                 const { data: userBadges } = await supabase
                    .from('user_badges')
                    .select('badge_id')
                    .eq('user_id', userId);
                 
                if (userBadges) {
                    setUnlockedBadgeIds(new Set((userBadges as any[]).map(b => b.badge_id)));
                }

            } catch (err) {
                console.error("Error fetching profile:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [userId, supabase]);

    if (isLoading) return <ProfileSkeleton />;
    if (!profile) return <div className="container py-20 text-center">用户不存在</div>;

    // Redirect to own profile if viewing self
    if (currentUser?.id === userId) {
         // Optionally redirect or just render this view (this view is public, so it's fine)
    }

    const level = Math.floor(Math.sqrt((profile.xp || 0) / 100)) + 1;
    const userName = profile.display_name || '匿名用户';

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            {/* Header Card */}
            <div className="bg-gradient-to-b from-muted/50 to-background rounded-2xl p-8 mb-8 border">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Avatar */}
                    <div className="relative">
                         <div className="h-32 w-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted">
                            {profile.avatar_url ? (
                                <Image 
                                    src={profile.avatar_url} 
                                    alt={userName} 
                                    fill 
                                    className="object-cover" 
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-5xl bg-gradient-to-br from-primary/20 to-secondary/20 font-bold text-primary">
                                    {userName[0].toUpperCase()}
                                </div>
                            )}
                         </div>
                         <div className="absolute -bottom-2 -right-2 bg-background rounded-full px-3 py-1 border shadow-sm text-sm font-bold flex items-center gap-1">
                            <span className="text-yellow-500">Lv.{level}</span>
                         </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{userName}</h1>
                            <p className="text-muted-foreground max-w-xl mx-auto md:mx-0">
                                {profile.bio || "这个人很懒，什么都没写~"}
                            </p>
                        </div>
                        
                        <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
                             <div className="flex flex-col items-center md:items-start">
                                <span className="font-bold text-lg">{projects.length}</span>
                                <span className="text-muted-foreground">项目</span>
                             </div>
                             <div className="flex flex-col items-center md:items-start">
                                <span className="font-bold text-lg">{followerCount}</span>
                                <span className="text-muted-foreground">粉丝</span>
                             </div>
                             <div className="flex flex-col items-center md:items-start">
                                <span className="font-bold text-lg">{followingCount}</span>
                                <span className="text-muted-foreground">关注</span>
                             </div>
                        </div>

                        <div className="pt-2">
                             <FollowButton targetUserId={profile.id} showCount={false} className="w-full md:w-auto px-8" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="projects" className="space-y-8">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="projects">项目 ({projects.length})</TabsTrigger>
                    <TabsTrigger value="badges">徽章 ({unlockedBadgeIds.size})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="projects" className="space-y-6">
                    {projects.length === 0 ? (
                        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
                            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                            <p className="text-muted-foreground">暂无发布项目</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map(project => (
                                <ProjectCard key={project.id} project={project} />
                            ))}
                        </div>
                    )}
                </TabsContent>
                
                <TabsContent value="badges">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {BADGES.map(badge => {
                            const isUnlocked = unlockedBadgeIds.has(badge.id);
                            return (
                                <div 
                                    key={badge.id}
                                    className={cn(
                                        "p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-3 transition-all",
                                        isUnlocked ? "bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20" : "opacity-40 grayscale bg-muted/50"
                                    )}
                                >
                                    <div className="text-4xl">{badge.icon}</div>
                                    <div>
                                        <div className="font-bold text-sm">{badge.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{badge.description}</div>
                                    </div>
                                    {isUnlocked ? (
                                        <Badge variant="secondary" className="text-[10px] h-5 bg-green-500/10 text-green-700 border-green-200">已解锁</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px] h-5">未解锁</Badge>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
