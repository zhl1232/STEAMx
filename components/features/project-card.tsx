"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Heart, ImageOff, Images } from "lucide-react";
import { CoinIcon } from "@/components/icons/coin-icon";
import { useOptionalProjects } from '@/lib/context/project-context';
import { Project } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

import { DifficultyStars } from "@/components/ui/difficulty-stars";
import { SearchHighlight } from "@/components/ui/search-highlight";
import { ToneBadge, type CategoryTone } from "@/components/ui/tone-badge";
import { CATEGORY_META } from "@/lib/config/categories";

interface ProjectCardProps {
    project: Project;
    searchQuery?: string;
    showStatus?: boolean;  // 是否显示状态Badge，默认false
    /** 首屏优先加载（用于探索页前几张卡片，提升 LCP） */
    priority?: boolean;
    href?: string;
    variant?: "default" | "featured" | "compact";
    compactLayout?: "adaptive" | "vertical" | "dense";
    className?: string;
}

function getCategoryTone(category?: string): CategoryTone {
    return CATEGORY_META[category || ""]?.tone ?? "science";
}

export function ProjectCard({ project, searchQuery = "", showStatus = false, priority = false, href, variant = "default", compactLayout = "adaptive", className }: ProjectCardProps) {
    const { isLiked, getLikesDelta } = useOptionalProjects();
    const liked = isLiked(project.id);
    const likesCount = (project.likes || 0) + getLikesDelta(project.id);
    const imageSrc = typeof project.image === "string" ? project.image.trim() : "";
    const [imageError, setImageError] = useState(false);
    const previewTag = project.tags?.find((tag) => tag !== project.category && tag !== project.sub_category);
    const detailHref = href || `/project/${project.id}`;
    const categoryTone = getCategoryTone(project.category);

    useEffect(() => {
        setImageError(false);
    }, [imageSrc]);

    if (variant === "compact") {
        const isVerticalCompact = compactLayout === "vertical";
        const isDenseCompact = compactLayout === "dense";

        return (
            <div className={cn("h-full transition-transform duration-300 hover:-translate-y-1", className)}>
                <div
                    className={cn(
                        "surface-card surface-card-interactive group relative h-full overflow-hidden rounded-md",
                        isVerticalCompact
                            ? "flex flex-col gap-0 p-0"
                            : isDenseCompact
                                ? "grid min-h-[112px] grid-cols-[88px_minmax(0,1fr)] gap-3 border-transparent bg-[hsl(var(--surface-raised)/0.92)] p-2.5 shadow-[0_2px_10px_hsl(var(--surface-shadow)/0.045)] sm:flex sm:flex-col sm:gap-0 sm:p-0 dark:bg-[hsl(var(--surface-raised)/0.72)] dark:border-[hsl(var(--surface-border)/0.94)] dark:shadow-[0_10px_28px_hsl(var(--surface-shadow)/0.18)]"
                                : "grid grid-cols-[128px_minmax(0,1fr)] gap-3 p-2.5 sm:flex sm:flex-col sm:gap-0 sm:p-0",
                    )}
                >
                    <Link
                        href={detailHref}
                        prefetch={false}
                        className="absolute inset-0 z-0"
                        aria-label={`查看项目：${project.title}`}
                    />

                    <div
                        className={cn(
                            "pointer-events-none relative w-full overflow-hidden bg-[hsl(var(--surface-muted))]",
                            isVerticalCompact
                                ? "aspect-16/10 rounded-none"
                                : isDenseCompact
                                    ? "h-full min-h-[92px] rounded-sm sm:aspect-16/8.5 sm:h-auto sm:min-h-0 sm:rounded-none"
                                    : "aspect-square rounded-sm sm:aspect-16/8.5 sm:rounded-none",
                        )}
                    >
                        {imageSrc && !imageError ? (
                            <OptimizedImage
                                src={imageSrc}
                                alt={project.title}
                                fill
                                variant="card"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={() => setImageError(true)}
                                priority={priority}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-[hsl(var(--surface-muted))]">
                                <ImageOff className="h-8 w-8 text-muted-foreground/70 sm:h-9 sm:w-9" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-slate-950/18 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        {project.difficulty_stars && !isDenseCompact ? (
                            <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-xs">
                                <DifficultyStars stars={project.difficulty_stars} size="xs" tone="white" />
                            </div>
                        ) : null}
                    </div>

                    <div
                        className={cn(
                            "pointer-events-none relative flex min-w-0 flex-col justify-between gap-2",
                            isVerticalCompact
                                ? "flex-1 p-3"
                                : isDenseCompact
                                    ? "py-0 sm:flex-1 sm:p-3.5"
                                    : "py-0.5 sm:flex-1 sm:p-3.5",
                        )}
                    >
                        <div className={cn("min-w-0", isDenseCompact ? "space-y-1" : "space-y-2")}>
                            <h3
                                className={cn(
                                    "min-w-0 font-bold text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))]",
                                    isDenseCompact ? "line-clamp-1 text-[14px] leading-5 sm:line-clamp-1 sm:text-[15px] sm:leading-6" : "text-[15px] leading-5",
                                    isVerticalCompact ? "line-clamp-2" : !isDenseCompact && "line-clamp-2 sm:line-clamp-1 sm:leading-6",
                                )}
                            >
                                <SearchHighlight text={project.title} query={searchQuery} />
                            </h3>

                            <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                                {project.category && (
                                    <ToneBadge tone={categoryTone} className="shrink-0 rounded-xs px-1.5 py-0.5 text-[10px] font-medium">
                                        {project.category}
                                    </ToneBadge>
                                )}
                                {project.category && project.sub_category && (
                                    <span className="text-[10px] text-muted-foreground/40 select-none" aria-hidden="true">•</span>
                                )}
                                {project.sub_category && (
                                    <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground/90">
                                        {project.sub_category}
                                    </span>
                                )}
                            </div>
                            <p
                                className={cn(
                                    "text-[11px] text-muted-foreground/95",
                                    isDenseCompact ? "line-clamp-1 leading-normal" : "leading-relaxed",
                                    isVerticalCompact ? "line-clamp-2" : !isDenseCompact && "line-clamp-3",
                                )}
                            >
                                <SearchHighlight
                                    text={project.description || "适合边做边学的 STEAM 实践项目。"}
                                    query={searchQuery}
                                />
                            </p>
                        </div>

                        {isDenseCompact ? (
                            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground/90 sm:mt-auto">
                                {project.difficulty_stars ? (
                                    <DifficultyStars stars={project.difficulty_stars} size="xs" className="shrink-0" />
                                ) : (
                                    <span aria-hidden className="h-3 shrink-0" />
                                )}
                                <div className="ml-auto flex items-center justify-end gap-2.5">
                                    <span className="flex items-center gap-1" title="点赞数">
                                        <Heart className={cn("h-3 w-3 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground/80")} />
                                        <span>{likesCount || 0}</span>
                                    </span>
                                    <span className="flex items-center gap-1" title="作品数">
                                        <Images className="h-3 w-3 text-muted-foreground/80" />
                                        <span>{project.completions_count ?? 0}</span>
                                    </span>
                                    <span className="flex items-center gap-1" title="投币数">
                                        <CoinIcon className="h-3.5 w-3.5 text-[hsl(var(--brand-amber))]" />
                                        <span>{project.coins_count ?? 0}</span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90 sm:mt-auto">
                                <span className="flex items-center gap-1" title="点赞数">
                                    <Heart className={cn("h-3 w-3 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground/80")} />
                                    {likesCount || 0}
                                </span>
                                <span className="flex items-center gap-1" title="作品数">
                                    <Images className="h-3 w-3 text-muted-foreground/80" />
                                    {project.completions_count ?? 0}
                                </span>
                                <span className="flex items-center gap-1" title="投币数">
                                    <CoinIcon className="h-3.5 w-3.5 text-[hsl(var(--brand-amber))]" />
                                    {project.coins_count ?? 0}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "featured") {
        return (
            <div className={cn("h-full transition-transform duration-300 hover:-translate-y-1.5", className)}>
                <div className="surface-card surface-card-interactive group relative flex h-full flex-col overflow-hidden">
                    <Link
                        href={detailHref}
                        prefetch={false}
                        className="absolute inset-0 z-0"
                        aria-label={`查看重点推荐项目：${project.title}`}
                    />

                    <div className="pointer-events-none relative aspect-video w-full overflow-hidden bg-[hsl(var(--surface-muted))] xl:aspect-auto xl:min-h-[300px] xl:flex-1">
                        {imageSrc && !imageError ? (
                            <OptimizedImage
                                src={imageSrc}
                                alt={project.title}
                                fill
                                variant="featured"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={() => setImageError(true)}
                                priority={priority}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-[hsl(var(--surface-muted))]">
                                <ImageOff className="h-10 w-10 text-muted-foreground/70" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-slate-950/68 via-slate-950/12 to-transparent" />

                        {showStatus && project.status && (
                            <div className="absolute left-3 top-3 z-10">
                                {project.status === 'pending' && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800 shadow-xs dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        待审核
                                    </span>
                                )}
                                {project.status === 'approved' && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 shadow-xs dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        已发布
                                    </span>
                                )}
                                {project.status === 'rejected' && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-xs dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        已拒绝
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-3.5 min-[390px]:p-4">
                            <div className="flex min-w-0 flex-wrap gap-2">
                                {project.category && (
                                    <span className="inline-flex items-center rounded-full border border-white/20 bg-black/34 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                                        {project.category}
                                    </span>
                                )}
                                {project.sub_category && (
                                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/14 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                                        {project.sub_category}
                                    </span>
                                )}
                            </div>
                            {project.difficulty_stars ? (
                                <div className="shrink-0 rounded-full border border-white/14 bg-black/30 px-2.5 py-1 backdrop-blur-md">
                                    <DifficultyStars stars={project.difficulty_stars} size="sm" />
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="pointer-events-none relative flex flex-col gap-3 p-4">
                        <div className="space-y-2">
                            <h3 className="line-clamp-2 text-[18px] font-extrabold leading-snug text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))]">
                                <SearchHighlight text={project.title} query={searchQuery} />
                            </h3>
                            <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                                <SearchHighlight
                                    text={project.description || "适合边做边学的 STEAM 实践项目。"}
                                    query={searchQuery}
                                />
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {previewTag ? (
                                <span className="inline-flex max-w-[160px] truncate rounded-xs bg-[hsl(var(--brand-blue)/0.1)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--brand-blue))]">
                                    {previewTag}
                                </span>
                            ) : null}
                            {project.tags?.length && !previewTag ? (
                                <span className="inline-flex max-w-[160px] truncate rounded-xs bg-[hsl(var(--surface-muted))] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                    {project.tags[0]}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-4 border-t border-[hsl(var(--surface-border))] pt-3 text-[12px] font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5" title="点赞数">
                                <Heart className={cn("h-3.5 w-3.5 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                                {likesCount || 0}
                            </span>
                            <span className="flex items-center gap-1.5" title="作品数">
                                <Images className="h-3.5 w-3.5 text-muted-foreground" />
                                {project.completions_count ?? 0}
                            </span>
                            <span className="flex items-center gap-1.5" title="硬币数">
                                <CoinIcon className="h-4 w-4 text-[hsl(var(--brand-amber))]" />
                                {project.coins_count ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("transition-transform duration-300 hover:-translate-y-1.5", className)}>
            <div className="surface-card surface-card-interactive group relative block overflow-hidden">
                {/* Main Card Link Overlay */}
                <Link
                    href={detailHref}
                    prefetch={false}
                    className="absolute inset-0 z-0"
                    aria-label={`查看项目：${project.title}`}
                />

                <div className="relative aspect-16/10 w-full overflow-hidden bg-muted pointer-events-none">
                    {imageSrc && !imageError ? (
                        <OptimizedImage
                            src={imageSrc}
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
                    <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* 状态Badge - 左上角 */}
                    {showStatus && project.status && (
                        <div className="absolute top-2 left-2 z-10">
                            {project.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-xs dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                                    ⏳ 待审核
                                </span>
                            )}
                            {project.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-300 shadow-xs dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                    ✓ 已发布
                                </span>
                            )}
                            {project.status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 border border-red-300 shadow-xs dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
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

                <div className="relative flex flex-col gap-4 bg-linear-to-br from-background via-background to-muted/20 p-4 pointer-events-none">
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
                        <span className="flex items-center gap-1.5" title="点赞数">
                            <Heart className={cn("h-3.5 w-3.5 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                            <span>{likesCount} 喜欢</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="作品数">
                            <Images className="h-3.5 w-3.5" />
                            <span>{project.completions_count ?? 0} 作品</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="投币数">
                            <CoinIcon className="h-[18px] w-[18px] text-amber-500" />
                            <span>{project.coins_count || 0} 投币</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
