"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Project } from "@/lib/mappers/types";
import { ProjectCard } from "@/components/features/project-card";
import { MobileCategoryGrid } from "@/components/home/mobile-category-grid";
import { MobileFeaturedCarousel } from "@/components/home/mobile-featured-carousel";
import { FollowingFeed } from "@/components/home/following-feed";
import { cn } from "@/lib/utils";
import { Flame, ChevronRight, Users } from "lucide-react";

interface MobileHomeProps {
    popularProjects: Project[];
}

type TabType = "recommend" | "following";

export function MobileHome({ popularProjects }: MobileHomeProps) {
    const [activeTab, setActiveTab] = useState<TabType>("recommend");

    return (
        <div className="flex flex-col min-h-screen bg-background pb-20">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MobileFeaturedCarousel />

                {/* King Kong Area - Category Navigation */}
                <MobileCategoryGrid />
                
                <div className="h-2 bg-muted/20 w-full" />

                {/* Tab 切换 */}
                <div className="flex items-center gap-6 px-4 py-3 sticky top-[calc(4rem+env(safe-area-inset-top))] bg-background/95 backdrop-blur z-20 border-b">
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
