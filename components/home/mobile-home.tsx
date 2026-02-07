"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Project } from "@/lib/mappers/types";
import { ProjectCard } from "@/components/features/project-card";
import { MobileCategoryGrid } from "@/components/home/mobile-category-grid";
import { FollowingFeed } from "@/components/home/following-feed";
import { cn } from "@/lib/utils";
import { Flame, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MobileHomeProps {
    latestProjects: Project[]; // Kept for interface compatibility, though simplified view might only use popular
    popularProjects: Project[];
}

type TabType = "recommend" | "following";

export function MobileHome({ popularProjects }: MobileHomeProps) {
    const [activeTab, setActiveTab] = useState<TabType>("recommend");

    return (
        <div className="flex flex-col min-h-screen bg-background pb-20">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Banner / Hero */}
                <div className="px-4 pt-4 pb-2">
                    <div className="relative aspect-[21/9] rounded-xl overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 shadow-sm">
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
                        <div className="absolute inset-0 p-4 flex flex-col justify-center text-white">
                            <Badge className="w-fit mb-2 bg-yellow-400 text-yellow-900 border-none px-2 py-0.5 text-[10px]">本周精选</Badge>
                            <h3 className="font-bold text-lg leading-tight mb-1">点亮你的 STEAM 创意</h3>
                            <p className="text-xs text-white/90">探索全球青少年的科创灵感库</p>
                        </div>
                    </div>
                </div>

                {/* King Kong Area - Category Navigation */}
                <MobileCategoryGrid />
                
                <div className="h-2 bg-muted/20 w-full" />

                {/* Tab 切换 */}
                <div className="flex items-center gap-6 px-4 py-3 sticky top-0 bg-background/95 backdrop-blur z-20 border-b">
                    <button
                        onClick={() => setActiveTab("recommend")}
                        className={cn(
                            "flex items-center gap-1.5 text-sm font-medium transition-colors pb-1",
                            activeTab === "recommend" 
                                ? "text-foreground border-b-2 border-primary" 
                                : "text-muted-foreground"
                        )}
                    >
                        <Flame className={cn("w-4 h-4", activeTab === "recommend" && "text-orange-500 fill-orange-500")} />
                        推荐
                    </button>
                    <button
                        onClick={() => setActiveTab("following")}
                        className={cn(
                            "flex items-center gap-1.5 text-sm font-medium transition-colors pb-1",
                            activeTab === "following" 
                                ? "text-foreground border-b-2 border-primary" 
                                : "text-muted-foreground"
                        )}
                    >
                        <Users className={cn("w-4 h-4", activeTab === "following" && "text-blue-500")} />
                        关注
                    </button>
                    
                    {/* 查看全部链接 - 仅在推荐 Tab 显示 */}
                    {activeTab === "recommend" && (
                        <Link href="/explore" className="ml-auto text-xs text-muted-foreground flex items-center hover:text-primary transition-colors">
                            全部 <ChevronRight className="w-3 h-3" />
                        </Link>
                    )}
                </div>

                {/* 内容区域 */}
                {activeTab === "recommend" ? (
                    <>
                        {/* 热门项目列表 */}
                        <div className="px-4 pt-4 grid grid-cols-1 gap-4">
                            {popularProjects.map(project => (
                                <ProjectCard key={project.id} project={project} />
                            ))}
                        </div>
                            
                        <div className="py-8 text-center">
                            <Link 
                                href="/explore" 
                                className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full"
                            >
                                查看更多项目
                            </Link>
                        </div>
                    </>
                ) : (
                    /* 关注动态 */
                    <div className="pt-4">
                        <FollowingFeed />
                    </div>
                )}
            </div>
        </div>
    );
}

