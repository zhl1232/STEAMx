"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { Project } from "@/lib/mappers/types";
import { ProjectCard } from "@/components/features/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Compass } from "lucide-react";

export function FollowingFeed() {
    const { user, loading: authLoading } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [followingCount, setFollowingCount] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const fetchFollowingProjects = async () => {
            if (authLoading) return;
            
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch("/api/following-feed", { signal: controller.signal });
                if (response.status === 401) {
                    setProjects([]);
                    setFollowingCount(0);
                    return;
                }
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                const payload = await response.json();
                setProjects((payload?.projects as Project[]) || []);
                setFollowingCount(payload?.followingCount || 0);
            } catch (err) {
                if ((err as { name?: string }).name === "AbortError") return;
                console.error("Error fetching following projects:", err);
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchFollowingProjects();
        return () => controller.abort();
    }, [user, authLoading]);

    // 加载中
    if (authLoading || isLoading) {
        return (
            <div className="px-4 space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl overflow-hidden border">
                        <Skeleton className="h-40 w-full" />
                        <div className="p-3 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // 未登录
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <UserPlus className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">登录查看关注动态</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    关注感兴趣的创作者，第一时间获取他们的新作品
                </p>
                <Button onClick={() => promptLogin(() => {}, { title: "登录", description: "登录后查看关注动态" })}>
                    立即登录
                </Button>
            </div>
        );
    }

    // 已登录但未关注任何人
    if (followingCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Compass className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">还没有关注任何人</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    去发现感兴趣的创作者，关注他们获取最新动态
                </p>
                <Link href="/explore">
                    <Button>探索创作者</Button>
                </Link>
            </div>
        );
    }

    // 有关注但没有项目
    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Compass className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">暂无动态</h3>
                <p className="text-sm text-muted-foreground">
                    你关注的创作者还没有发布作品
                </p>
            </div>
        );
    }

    // 正常显示项目列表
    return (
        <div className="px-4 grid grid-cols-1 gap-4">
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
}
