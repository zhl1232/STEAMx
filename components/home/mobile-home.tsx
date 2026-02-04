"use client";

import React from "react";
import Link from "next/link";
import { Project } from "@/lib/mappers/types";
import { ProjectCard } from "@/components/features/project-card";
import { MobileCategoryGrid } from "@/components/home/mobile-category-grid";
import { cn } from "@/lib/utils";
import { Flame, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MobileHomeProps {
    latestProjects: Project[]; // Kept for interface compatibility, though simplified view might only use popular
    popularProjects: Project[];
}

export function MobileHome({ popularProjects }: MobileHomeProps) {
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

                {/* Section Title */}
                <div className="px-4 py-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-20">
                    <h3 className="font-bold flex items-center gap-2 text-base">
                        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> 
                        热门项目
                    </h3>
                    <Link href="/explore" className="text-xs text-muted-foreground flex items-center hover:text-primary transition-colors">
                        全部 <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>

                {/* Waterfall Flow / List */}
                <div className="px-4 grid grid-cols-1 gap-4">
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
            </div>
        </div>
    );
}
