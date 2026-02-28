"use client";

import { useEffect, useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/lib/types";
import { mapProject, DbProject } from "@/lib/mappers/project";
import { Button } from "@/components/ui/button";
import { ProfileSkeleton } from "@/components/features/profile/profile-skeleton";
import { ProjectCard } from "@/components/features/project-card";
import { FollowButton } from "@/components/features/social/follow-button";
// Note: removed useFollow import as we now query follower count directly
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { FolderOpen, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { BADGES } from "@/context/gamification-context";
import { ProfileSchema, ProjectSchema } from "@/lib/schemas";
import { z } from "zod";

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
  // params.id can be string | string[] | undefined in Next.js
  const rawId = params?.id;
  const userId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  
  const { user: currentUser } = useAuth();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        // 1. Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        // Validate Profile Data
        const profileResult = ProfileSchema.safeParse(profileData);
        if (!profileResult.success) {
          console.error("Profile validation passed with errors:", profileResult.error);
          // In a strict environment, we might throw here. For now, we log and proceed if possible, 
          // or we can allow partial data if we relax schema. 
          // Let's assume we want to ensure data quality.
        }
        
        // We use the raw data if valid, or fallback/throw. 
        // For this task, strict safety suggests we ideally use valid data.
        // But since we are introducing this to an existing app, let's use the parsed data if successful,
        // otherwise warn but try to use raw data (or throw if you want strictly enforcing).
        // Let's Enforce!
        if (!profileResult.success) {
             throw new Error("Invalid profile data received from server");
        }
        setProfile(profileResult.data as PublicProfile); // strict cast to our UI type if needed, or update UI type to use Zod infer

        // 2. Fetch Projects
        const { data: projectsData } = await supabase
          .from("projects")
          .select("*")
          .eq("author_id", userId)
          .order("created_at", { ascending: false });

        if (projectsData) {
          // Validate Projects Data
          // We use partial validation essentially by picking what we defined in schema, 
          // but passthrough() might be needed if we select * and schema is partial.
          // Let's use array of schema.
          const projectsResult = z.array(ProjectSchema).safeParse(projectsData);
          if (!projectsResult.success) {
             console.error("Projects validation errors:", projectsResult.error);
             // For lists, maybe we filter out bad ones? Or just warn.
          }
          
          setProjects(
            projectsData.map((p) =>
              mapProject(p as DbProject, (profileData as PublicProfile)?.display_name || undefined),
            ),
          );
        }

        // 3. Fetch Follow Stats (粉丝数和关注数)
        const { count: followers } = await supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', userId);
        setFollowerCount(followers || 0);

        const { count: following } = await supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', userId);
        setFollowingCount(following || 0);

        // 4. Fetch Badges
        const { data: userBadges } = await supabase
          .from("user_badges")
          .select("badge_id")
          .eq("user_id", userId);

        if (userBadges) {
          setUnlockedBadgeIds(new Set(userBadges.map((b: { badge_id: string }) => b.badge_id)));
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
  const userName = profile.display_name || "匿名用户";

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header Card */}
      <div className="bg-gradient-to-b from-muted/50 to-background rounded-2xl p-8 mb-8 border">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar */}
          <div className="relative">
            <div className="relative h-32 w-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted">
              {profile.avatar_url ? (
                <OptimizedImage src={profile.avatar_url} alt={userName} fill variant="avatar" className="object-cover" />
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

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <FollowButton
                targetUserId={profile.id}
                showCount={false}
                className="w-full md:w-auto px-8"
              />
              {currentUser && currentUser.id !== userId && (
                <Button variant="outline" className="w-full md:w-auto px-8" asChild>
                  <Link href={`/messages/${userId}`}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    发私信
                  </Link>
                </Button>
              )}
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
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="badges">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {BADGES.map((badge) => {
              const isUnlocked = unlockedBadgeIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-3 transition-all",
                    isUnlocked
                      ? "bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20"
                      : "bg-muted/30 border-muted",
                  )}
                >
                  <BadgeIcon 
                    icon={badge.icon} 
                    tier={badge.tier} 
                    size="lg" 
                    locked={!isUnlocked}
                  />
                  <div>
                    <div className="font-bold text-sm">{badge.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {badge.description}
                    </div>
                  </div>
                  {isUnlocked ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-5 bg-green-500/10 text-green-700 border-green-200"
                    >
                      已解锁
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-5">
                      未解锁
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
