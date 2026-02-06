"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenBox } from "lucide-react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProjectList } from "@/components/profile/project-list";
import { Project, Profile } from "@/lib/mappers/types";
import { User } from "@supabase/supabase-js";

interface MobileProfilePageProps {
  user: User;
  profile: Profile | null;
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
  const [_activeTab, setActiveTab] = useState("works");

  const myProjectsCount = myProjects.length;
  const likedProjectsCount = likedProjectsList.length;
  const collectedProjectsCount = collectedProjectsList.length;
  const completedProjectsCount = completedProjectsList.length;
  const totalLikesReceived = myProjects.reduce((acc, p) => acc + p.likes, 0);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      
      <ProfileHeader 
        user={user}
        profile={profile}
        myProjectsCount={myProjectsCount}
        likedProjectsCount={likedProjectsCount}
        collectedProjectsCount={collectedProjectsCount}
        totalLikesReceived={totalLikesReceived}
      />

      {/* Tabs Content */}
      <Tabs defaultValue="works" className="w-full flex-1" onValueChange={setActiveTab}>
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4">
            <TabsList className="w-full h-11 bg-transparent p-0 justify-start gap-4 overflow-x-auto scrollbar-none">
                <TabsTrigger 
                    value="works" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium text-sm shrink-0"
                >
                    作品 <span className="ml-1 text-xs text-muted-foreground">{myProjectsCount}</span>
                </TabsTrigger>
                <TabsTrigger 
                    value="collected" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium text-sm shrink-0"
                >
                    收藏 <span className="ml-1 text-xs text-muted-foreground">{collectedProjectsCount}</span>
                </TabsTrigger>
                <TabsTrigger 
                    value="likes" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium text-sm shrink-0"
                >
                    喜欢 <span className="ml-1 text-xs text-muted-foreground">{likedProjectsCount}</span>
                </TabsTrigger>
                 <TabsTrigger 
                    value="completed" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium text-sm shrink-0"
                >
                    完成 <span className="ml-1 text-xs text-muted-foreground">{completedProjectsCount}</span>
                </TabsTrigger>
            </TabsList>
        </div>

        <div className="px-4 py-4 min-h-[300px]">
            <TabsContent value="works" className="mt-0 space-y-4">
               <ProjectList 
                  projects={myProjects} 
                  emptyState={{
                      icon: <PenBox className="h-10 w-10" />,
                      title: "暂无作品",
                      desc: "分享你的第一个创意作品",
                      btnText: "去分享",
                      href: "/share"
                  }}
               />
            </TabsContent>
            <TabsContent value="collected" className="mt-0 space-y-4">
                <ProjectList 
                  projects={collectedProjectsList} 
                  emptyState={{
                      title: "暂无收藏",
                      desc: "收藏你喜欢的项目",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
            <TabsContent value="likes" className="mt-0 space-y-4">
                <ProjectList 
                  projects={likedProjectsList} 
                  emptyState={{
                      title: "暂无喜欢",
                      desc: "去发现更多有趣的项目",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
            <TabsContent value="completed" className="mt-0 space-y-4">
                 <ProjectList 
                  projects={completedProjectsList} 
                  emptyState={{
                      title: "暂无完成",
                      desc: "动手完成一个项目吧",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
