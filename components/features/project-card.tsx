"use client"

import { useState } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Heart, ImageOff, MessageCircle, CircleStop } from "lucide-react";
import { useProjects } from "@/context/project-context";
import { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DifficultyStars } from "@/components/ui/difficulty-stars";
import { SearchHighlight } from "@/components/ui/search-highlight";

interface ProjectCardProps {
    project: Project;
    searchQuery?: string;
    showStatus?: boolean;  // 是否显示状态Badge，默认false
    /** 首屏优先加载（用于探索页前几张卡片，提升 LCP） */
    priority?: boolean;
}

export function ProjectCard({ project, searchQuery = "", showStatus = false, priority = false }: ProjectCardProps) {
    const { isLiked, getLikesDelta } = useProjects();
    const liked = isLiked(project.id);
    const likesCount = project.likes + getLikesDelta(project.id);
    const [imageError, setImageError] = useState(false);

    return (
        <div className="transform transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20">
            <div
                className="group relative block overflow-hidden rounded-lg border bg-background transition-all"
            >
                {/* Main Card Link Overlay */}
                <Link
                    href={project.id === "color-lab" ? "/project/color-lab" : `/project/${project.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`View project ${project.title}`}
                />

                <div className="aspect-video w-full overflow-hidden bg-muted relative pointer-events-none">
                    {!imageError ? (
                        <OptimizedImage
                            src={project.image}
                            alt={project.title}
                            fill
                            variant="card"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={() => setImageError(true)}
                            priority={priority}
                            blurPlaceholder
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full bg-muted">
                            <ImageOff className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                    )}
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* 状态Badge - 左上角 */}
                    {showStatus && project.status && (
                        <div className="absolute top-2 left-2 z-10">
                            {project.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                                    ⏳ 待审核
                                </span>
                            )}
                            {project.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-300 shadow-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                    ✓ 已发布
                                </span>
                            )}
                            {project.status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 border border-red-300 shadow-sm dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                    ✕ 已拒绝
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gradient-to-br from-background to-background/95 relative pointer-events-none flex flex-col gap-2.5">
                    {/* 1. 标题放在最上方，与统计数据并列 */}
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors flex-1">
                            <SearchHighlight text={project.title} query={searchQuery} />
                        </h3>

                        {/* 统计数据放在标题右侧 */}
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground shrink-0 pt-0.5">
                            <span className="flex items-center gap-1 group/stat" title="评论数">
                                <MessageCircle className="h-3.5 w-3.5 group-hover/stat:text-primary transition-colors" />
                                <span>{project.comments_count ?? 0}</span>
                            </span>
                            <span className="flex items-center gap-1 group/stat" title="投币数">
                                <CircleStop className="h-3.5 w-3.5 group-hover/stat:text-yellow-500 transition-colors" />
                                <span>{project.coins_count || 0}</span>
                            </span>
                            <span className="flex items-center gap-1 group/stat" title="点赞数">
                                <Heart className={cn("h-3.5 w-3.5 transition-colors", liked ? "fill-red-500 text-red-500 group-hover/stat:text-red-600" : "group-hover/stat:text-red-500")} />
                                <span>{likesCount}</span>
                            </span>
                        </div>
                    </div>

                    {/* 2. 弱化并重新排列标签和难度 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
                            {project.category}
                        </span>
                        {project.sub_category && (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {project.sub_category}
                            </span>
                        )}
                        {project.tags?.slice(0, 2).map((tag) => (
                            <span key={tag} className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                                {tag}
                            </span>
                        ))}
                        {project.difficulty_stars && (
                            <div className="ml-1 flex items-center">
                                <DifficultyStars stars={project.difficulty_stars} size="sm" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
