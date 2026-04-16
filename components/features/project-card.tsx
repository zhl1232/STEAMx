"use client"

import { useState } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Heart, ImageOff, MessageCircle } from "lucide-react";
import { CoinIcon } from "@/components/icons/coin-icon";
import { useOptionalProjects } from '@/lib/context/project-context';
import { Project } from "@/lib/mappers/types";
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
    const { isLiked, getLikesDelta } = useOptionalProjects();
    const liked = isLiked(project.id);
    const likesCount = project.likes + getLikesDelta(project.id);
    const [imageError, setImageError] = useState(false);
    const previewTag = project.tags?.find((tag) => tag !== project.category && tag !== project.sub_category);

    return (
        <div className="transition-transform duration-300 hover:-translate-y-1.5">
            <div className="group relative block overflow-hidden rounded-[24px] border border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)] transition-all hover:shadow-[0_24px_55px_-28px_rgba(15,23,42,0.34)]">
                {/* Main Card Link Overlay */}
                <Link
                    href={`/project/${project.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`查看项目：${project.title}`}
                />

                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted pointer-events-none">
                    {!imageError ? (
                        <OptimizedImage
                            src={project.image}
                            alt={project.title}
                            fill
                            variant="card"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={() => setImageError(true)}
                            priority={priority}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full bg-muted">
                            <ImageOff className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

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

                    <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
                        <div className="flex min-w-0 flex-wrap gap-2">
                            {project.category && (
                                <span className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                                    {project.category}
                                </span>
                            )}
                            {project.sub_category && (
                                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/88 backdrop-blur-md">
                                    {project.sub_category}
                                </span>
                            )}
                        </div>
                        {project.difficulty_stars ? (
                            <div className="shrink-0 rounded-full border border-white/12 bg-black/26 px-2.5 py-1 backdrop-blur-md">
                                <DifficultyStars stars={project.difficulty_stars} size="sm" />
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="relative flex flex-col gap-4 bg-gradient-to-br from-background via-background to-muted/20 p-4 pointer-events-none">
                    <div className="space-y-2">
                        <h3 className="flex-1 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
                            <SearchHighlight text={project.title} query={searchQuery} />
                        </h3>
                        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            <SearchHighlight
                                text={project.description || "适合边做边学的 STEAM 实践项目。"}
                                query={searchQuery}
                            />
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {previewTag ? (
                            <span className="inline-flex max-w-[140px] items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
                                {previewTag}
                            </span>
                        ) : null}
                        {project.tags?.length && !previewTag ? (
                            <span className="inline-flex max-w-[160px] items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {project.tags[0]}
                            </span>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5" title="评论数">
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>{project.comments_count ?? 0} 评论</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="投币数">
                            <CoinIcon className="h-[18px] w-[18px] text-amber-500" />
                            <span>{project.coins_count || 0} 投币</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="点赞数">
                            <Heart className={cn("h-3.5 w-3.5 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                            <span>{likesCount} 喜欢</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
