"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, BadgeTier } from "@/lib/gamification/types";
import { SERIES_ORDER } from "@/lib/gamification/badges";

// ... existing imports
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// ... existing imports
import { BadgeIcon } from "./badge-icon";

const TIER_ORDER: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
type GalleryMode = "all" | "unlocked" | "locked";

const SERIES_COPY: Partial<Record<string, string>> = {
    intro_likes: "从第一次点赞开始积累平台互动热度。",
    intro_publish: "把灵感真正发布出来，形成持续输出。",
    intro_collections: "把值得回看的项目收进自己的灵感库。",
    science_expert: "观察、实验与验证，形成科学主题的连续完成。",
    tech_expert: "偏向代码、系统和数字工具的技术向成就。",
    engineering_expert: "更强调结构、搭建和实现路径的工程能力。",
    art_expert: "创作、审美和表达方向的作品积累。",
    math_expert: "数字推演、计算和规则思维的完成记录。",
    social: "讨论、回复和交流形成的社区参与度。",
    popularity: "作品或发言被更多人看见和认可。",
    milestone: "持续完成项目作品带来的长期里程碑。",
    level: "等级增长对应的整体成长轨迹。",
    challenge: "参与挑战，进入更明确的目标场景。",
    streak: "连续登录和持续返回形成的习惯强度。",
    bird_observer: "观察记录数量，代表持续看见自然的次数。",
    species_collector: "不同物种的累计发现，更强调广度。",
    first_steps: "适合新用户的起步徽章，很快就能点亮第一组。",
    minesweeper: "速度、判断和排除风险的扫雷成就。",
    gomoku: "布局、博弈与连珠判断。",
    game2048: "数字合成、上限突破和分数表现。",
    game24: "心算、连胜和解题速度。",
    life: "从运行到观察演化，理解涌现与结构。",
    hanoi: "递归思维和最优路径意识。",
    sudoku: "约束推理、排除法和耐心。",
    nqueens: "回溯搜索与全局布局能力。",
    circuit: "电路、逻辑门与通路构造。",
    sorting: "通过可视化体验不同排序算法的过程。",
    rare: "限定、纪念或人工授予的特别徽章。",
};

type SeriesTheme = { section: string; chip: string };

const THEME_AMBER: SeriesTheme = {
    section: "border-amber-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_42%),linear-gradient(180deg,rgba(255,251,235,0.94),rgba(255,255,255,0.96))] dark:border-amber-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_36%),linear-gradient(180deg,rgba(41,30,12,0.96),rgba(9,14,26,0.98))]",
    chip: "border-amber-200/80 bg-amber-50/95 text-amber-800 dark:border-amber-300/55 dark:bg-amber-950/85 dark:text-amber-50",
};
const THEME_SKY: SeriesTheme = {
    section: "border-sky-200/70 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_42%),linear-gradient(180deg,rgba(239,246,255,0.94),rgba(255,255,255,0.96))] dark:border-sky-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.2),transparent_36%),linear-gradient(180deg,rgba(11,33,58,0.96),rgba(9,14,26,0.98))]",
    chip: "border-sky-200/80 bg-sky-50/95 text-sky-800 dark:border-sky-300/55 dark:bg-sky-950/85 dark:text-sky-50",
};
const THEME_EMERALD: SeriesTheme = {
    section: "border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96))] dark:border-emerald-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_36%),linear-gradient(180deg,rgba(8,44,37,0.96),rgba(9,14,26,0.98))]",
    chip: "border-emerald-200/80 bg-emerald-50/95 text-emerald-800 dark:border-emerald-300/55 dark:bg-emerald-950/85 dark:text-emerald-50",
};
const THEME_CYAN: SeriesTheme = {
    section: "border-cyan-200/70 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.18),transparent_40%),linear-gradient(180deg,rgba(236,254,255,0.94),rgba(255,255,255,0.96))] dark:border-cyan-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.24),transparent_34%),linear-gradient(180deg,rgba(7,41,49,0.96),rgba(9,14,26,0.98))]",
    chip: "border-cyan-200/80 bg-cyan-50/95 text-cyan-800 dark:border-cyan-300/55 dark:bg-cyan-950/85 dark:text-cyan-50",
};
const THEME_INDIGO: SeriesTheme = {
    section: "border-indigo-200/70 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.16),transparent_42%),linear-gradient(180deg,rgba(238,242,255,0.94),rgba(255,255,255,0.96))] dark:border-indigo-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.22),transparent_36%),linear-gradient(180deg,rgba(24,31,72,0.96),rgba(9,14,26,0.98))]",
    chip: "border-indigo-200/80 bg-indigo-50/95 text-indigo-800 dark:border-indigo-300/55 dark:bg-indigo-950/85 dark:text-indigo-50",
};
const THEME_PINK: SeriesTheme = {
    section: "border-pink-200/70 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_42%),linear-gradient(180deg,rgba(253,242,248,0.94),rgba(255,255,255,0.96))] dark:border-pink-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.2),transparent_36%),linear-gradient(180deg,rgba(61,20,44,0.96),rgba(9,14,26,0.98))]",
    chip: "border-pink-200/80 bg-pink-50/95 text-pink-800 dark:border-pink-300/55 dark:bg-pink-950/85 dark:text-pink-50",
};
const THEME_FUCHSIA: SeriesTheme = {
    section: "border-fuchsia-200/70 bg-[radial-gradient(circle_at_top_left,rgba(192,132,252,0.14),transparent_42%),linear-gradient(180deg,rgba(250,245,255,0.94),rgba(255,255,255,0.96))] dark:border-fuchsia-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(192,132,252,0.2),transparent_36%),linear-gradient(180deg,rgba(57,21,67,0.96),rgba(9,14,26,0.98))]",
    chip: "border-fuchsia-200/80 bg-fuchsia-50/95 text-fuchsia-800 dark:border-fuchsia-300/55 dark:bg-fuchsia-950/85 dark:text-fuchsia-50",
};
const THEME_ROSE: SeriesTheme = {
    section: "border-rose-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.14),transparent_42%),linear-gradient(180deg,rgba(255,241,242,0.94),rgba(255,255,255,0.96))] dark:border-rose-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.2),transparent_36%),linear-gradient(180deg,rgba(63,22,36,0.96),rgba(9,14,26,0.98))]",
    chip: "border-rose-200/80 bg-rose-50/95 text-rose-800 dark:border-rose-300/55 dark:bg-rose-950/85 dark:text-rose-50",
};
const THEME_YELLOW: SeriesTheme = {
    section: "border-yellow-200/70 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_42%),linear-gradient(180deg,rgba(254,252,232,0.94),rgba(255,255,255,0.96))] dark:border-yellow-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.22),transparent_36%),linear-gradient(180deg,rgba(53,43,11,0.96),rgba(9,14,26,0.98))]",
    chip: "border-yellow-200/80 bg-yellow-50/95 text-yellow-800 dark:border-yellow-300/55 dark:bg-yellow-950/85 dark:text-yellow-50",
};
const THEME_VIOLET: SeriesTheme = {
    section: "border-violet-200/70 bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.16),transparent_42%),linear-gradient(180deg,rgba(245,243,255,0.94),rgba(255,255,255,0.96))] dark:border-violet-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.22),transparent_36%),linear-gradient(180deg,rgba(40,24,67,0.96),rgba(9,14,26,0.98))]",
    chip: "border-violet-200/80 bg-violet-50/95 text-violet-800 dark:border-violet-300/55 dark:bg-violet-950/85 dark:text-violet-50",
};
const THEME_ORANGE: SeriesTheme = {
    section: "border-orange-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_42%),linear-gradient(180deg,rgba(255,247,237,0.94),rgba(255,255,255,0.96))] dark:border-orange-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.22),transparent_36%),linear-gradient(180deg,rgba(63,31,15,0.96),rgba(9,14,26,0.98))]",
    chip: "border-orange-200/80 bg-orange-50/95 text-orange-800 dark:border-orange-300/55 dark:bg-orange-950/85 dark:text-orange-50",
};
const THEME_RED: SeriesTheme = {
    section: "border-red-200/70 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_42%),linear-gradient(180deg,rgba(254,242,242,0.94),rgba(255,255,255,0.96))] dark:border-red-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.22),transparent_36%),linear-gradient(180deg,rgba(64,24,24,0.96),rgba(9,14,26,0.98))]",
    chip: "border-red-200/80 bg-red-50/95 text-red-800 dark:border-red-300/55 dark:bg-red-950/85 dark:text-red-50",
};
const THEME_TEAL: SeriesTheme = {
    section: "border-teal-200/70 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_42%),linear-gradient(180deg,rgba(240,253,250,0.94),rgba(255,255,255,0.96))] dark:border-teal-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_36%),linear-gradient(180deg,rgba(9,47,43,0.96),rgba(9,14,26,0.98))]",
    chip: "border-teal-200/80 bg-teal-50/95 text-teal-800 dark:border-teal-300/55 dark:bg-teal-950/85 dark:text-teal-50",
};
const THEME_LIME: SeriesTheme = {
    section: "border-lime-200/70 bg-[radial-gradient(circle_at_top_left,rgba(134,239,172,0.16),transparent_42%),linear-gradient(180deg,rgba(247,254,231,0.94),rgba(255,255,255,0.96))] dark:border-lime-400/30 dark:bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.22),transparent_36%),linear-gradient(180deg,rgba(35,54,12,0.96),rgba(9,14,26,0.98))]",
    chip: "border-lime-200/80 bg-lime-50/95 text-lime-800 dark:border-lime-300/55 dark:bg-lime-950/85 dark:text-lime-50",
};
const THEME_ZINC: SeriesTheme = {
    section: "border-zinc-300/80 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.14),transparent_40%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.96))] dark:border-slate-400/25 dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.18),transparent_34%),linear-gradient(180deg,rgba(32,39,49,0.96),rgba(9,14,26,0.98))]",
    chip: "border-slate-200/80 bg-slate-50/95 text-slate-800 dark:border-slate-300/45 dark:bg-slate-900/90 dark:text-slate-50",
};

const SERIES_THEME: Partial<Record<string, SeriesTheme>> = {
    intro_likes: THEME_AMBER,
    intro_publish: THEME_SKY,
    intro_collections: THEME_EMERALD,
    science_expert: THEME_CYAN,
    tech_expert: THEME_INDIGO,
    engineering_expert: THEME_ORANGE,
    art_expert: THEME_PINK,
    math_expert: THEME_EMERALD,
    social: THEME_FUCHSIA,
    popularity: THEME_ROSE,
    milestone: THEME_YELLOW,
    level: THEME_VIOLET,
    challenge: THEME_ORANGE,
    streak: THEME_RED,
    bird_observer: THEME_TEAL,
    species_collector: THEME_LIME,
    first_steps: THEME_VIOLET,
    minesweeper: THEME_ZINC,
    gomoku: THEME_AMBER,
    game2048: THEME_YELLOW,
    game24: THEME_EMERALD,
    life: THEME_LIME,
    hanoi: THEME_ORANGE,
    sudoku: THEME_ZINC,
    nqueens: THEME_VIOLET,
    circuit: THEME_CYAN,
    sorting: THEME_CYAN,
    rare: THEME_PINK,
};

// TIER_STYLES removed as they are now in BadgeIcon

interface BadgeGalleryDialogProps {
    badges: Badge[];
    unlockedBadges: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    children?: React.ReactNode;
}

interface SeriesStatus {
    completed: boolean;
    nextBadge: Badge | null;
    unlockedCount: number;
    totalCount: number;
    highestUnlockedBadge: Badge | null;
    tiered: boolean;
}

function groupBadgesBySeries(badges: Badge[]): Map<string, Badge[]> {
    const map = new Map<string, Badge[]>();
    for (const badge of badges) {
        const key = badge.seriesKey ?? "other";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(badge);
    }
    for (const [, list] of map) {
        list.sort((a, b) => {
            if (a.tier && b.tier) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            return 0;
        });
    }
    return map;
}

function getSeriesStatus(seriesList: Badge[], unlockedBadges: Set<string>): SeriesStatus {
    const unlocked = seriesList.filter((badge) => unlockedBadges.has(badge.id));
    const unlockedCount = unlocked.length;
    const totalCount = seriesList.length;
    const completed = unlockedCount === totalCount;
    const tiered = seriesList.length === 4 && seriesList.every((badge) => Boolean(badge.tier));
    const nextBadge = completed ? null : seriesList.find((badge) => !unlockedBadges.has(badge.id)) ?? null;
    const highestUnlockedBadge = unlocked.length === 0
        ? null
        : unlocked.reduce((a, b) =>
            TIER_ORDER[(b.tier as BadgeTier)] > TIER_ORDER[(a.tier as BadgeTier)] ? b : a
        );

    return { completed, nextBadge, unlockedCount, totalCount, highestUnlockedBadge, tiered };
}

function getBadgeRequirementHint(badge: Badge | null) {
    if (!badge) return null;
    if (badge.description.startsWith("首次")) {
        return `${badge.description.replace(/^首次/, "完成第一次")}，点亮「${badge.name}」。`;
    }
    if (badge.description.startsWith("累计")) {
        return `${badge.description.replace(/^累计/, "继续累计到")}，解锁「${badge.name}」。`;
    }
    if (badge.description.startsWith("完成")) {
        return `${badge.description}，收下「${badge.name}」。`;
    }
    if (badge.description.startsWith("达到")) {
        return `${badge.description}，晋级「${badge.name}」。`;
    }
    return `${badge.description}，解锁「${badge.name}」。`;
}

function getSeriesProgressText(seriesStatus: SeriesStatus, mode: GalleryMode) {
    if (!seriesStatus.tiered) {
        return mode === "locked"
            ? `${seriesStatus.totalCount - seriesStatus.unlockedCount} 枚待解锁`
            : `${seriesStatus.unlockedCount}/${seriesStatus.totalCount} 枚已点亮`;
    }

    if (mode === "locked") {
        return seriesStatus.completed
            ? "阶梯已满级"
            : seriesStatus.nextBadge
                ? `下一枚：${seriesStatus.nextBadge.name}`
                : "下一档待解锁";
    }

    if (!seriesStatus.highestUnlockedBadge) {
        return "尚未达成";
    }

    if (seriesStatus.completed) {
        return `已满级 · ${seriesStatus.highestUnlockedBadge.name}`;
    }

    return `当前：${seriesStatus.highestUnlockedBadge.name}`;
}

export function BadgeGalleryDialog({ badges, unlockedBadges, userBadgeDetails, children }: BadgeGalleryDialogProps) {
    const [open, setOpen] = useState(false);

    const unlockedList = badges.filter((b) => unlockedBadges.has(b.id));
    const lockedList = badges.filter((b) => !unlockedBadges.has(b.id));
    const grouped = useMemo(() => groupBadgesBySeries(badges), [badges]);

    const BadgeCard = ({ badge, isUnlocked, seriesStatus }: { badge: Badge; isUnlocked: boolean; seriesStatus: SeriesStatus }) => {
        const details = userBadgeDetails?.get(badge.id);
        const unlockedDate = details?.unlockedAt ? new Date(details.unlockedAt).toLocaleDateString() : null;
        const nextRequirement = getBadgeRequirementHint(seriesStatus.nextBadge);

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className={cn(
                            "relative flex h-full cursor-pointer flex-col items-center gap-1.5 overflow-hidden rounded-sm border p-2 text-center transition-all duration-200 group hover:shadow-md sm:gap-2 sm:p-3",
                            isUnlocked
                                ? "bg-linear-to-br from-white/80 via-white/60 to-white/35 border-white/70 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.35)] hover:border-primary/30 dark:from-slate-800/96 dark:via-slate-900/94 dark:to-slate-950/92 dark:border-white/12 dark:shadow-[0_16px_32px_-20px_rgba(0,0,0,0.78)] dark:hover:border-primary/25"
                                : "bg-white/55 border-slate-200/80 opacity-95 dark:bg-slate-950/82 dark:border-white/8 dark:opacity-100",
                        )}
                    >
                        <div className="relative flex justify-center p-1 sm:p-2">
                            <BadgeIcon 
                                icon={badge.icon} 
                                tier={badge.tier} 
                                seriesKey={badge.seriesKey}
                                size="md" 
                                locked={!isUnlocked}
                                className="w-10 h-10 sm:w-12 sm:h-12"
                            />
                        </div>
                        
                        <div className="w-full flex-1 flex flex-col justify-start min-h-0">
                            <div className={cn(
                                "font-semibold text-[10px] sm:text-sm line-clamp-2 leading-tight",
                                isUnlocked ? "text-foreground" : "text-slate-700 dark:text-slate-300"
                            )}>
                                {badge.name}
                            </div>
                            {isUnlocked && unlockedDate ? (
                                <div className="mt-1 text-[10px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                                    {unlockedDate} 获得
                                </div>
                            ) : null}
                            {/* Hide description on mobile for cleaner look */}
                            <div className="mt-1 hidden line-clamp-2 text-[10px] leading-tight text-slate-600 dark:text-slate-400 sm:block sm:text-xs">
                                {badge.description}
                            </div>
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 p-2" align="center">
                    <DropdownMenuLabel className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="leading-snug">{badge.name}</span>
                        </span>
                        {isUnlocked && <span className="status-success-surface shrink-0 text-[10px] font-normal px-1.5 py-0.5 rounded border text-[hsl(var(--status-success))]">已获得</span>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground leading-relaxed">
                        {badge.description}
                    </div>
                    {isUnlocked && unlockedDate && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground flex justify-between">
                                <span>获得时间</span>
                                <span>{unlockedDate}</span>
                            </div>
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[10px] text-muted-foreground flex justify-between">
                        <span>系列进度</span>
                        <span>{seriesStatus.unlockedCount}/{seriesStatus.totalCount}</span>
                    </div>
                    {seriesStatus.completed ? (
                        <div className="px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                            本系列已收藏完成
                        </div>
                    ) : nextRequirement ? (
                        <div className="px-2 py-1 text-[10px] text-primary/85">
                            下一目标：{nextRequirement}
                        </div>
                    ) : null}
                    {!isUnlocked && (
                         <div className="px-2 py-1 text-[10px] text-orange-500/80 mt-1 italic">
                             尚未解锁
                         </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const renderGroupedGrid = (badgeList: Badge[], mode: GalleryMode) => {
        const visibleIds = new Set(badgeList.map((badge) => badge.id));

        const sections = SERIES_ORDER.map(({ key: seriesKey, label }) => {
            const fullSeries = grouped.get(seriesKey) ?? [];
            if (fullSeries.length === 0) return null;

            const showList = fullSeries.filter((badge) => visibleIds.has(badge.id));
            if (showList.length === 0) return null;

            const seriesStatus = getSeriesStatus(fullSeries, unlockedBadges);
            const { completed } = seriesStatus;
            const progressText = getSeriesProgressText(seriesStatus, mode);
            const theme = SERIES_THEME[seriesKey];

            return (
                <section
                    key={seriesKey}
                    className={cn(
                        "relative rounded-(--radius-lg) border p-3 shadow-xs backdrop-blur-xs dark:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.72)] sm:p-4",
                        theme?.section ?? "border-border/70 bg-background/95 dark:border-white/10 dark:bg-slate-900/95"
                    )}
                >
                    <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{label}</h3>
                                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-xs sm:text-[11px]", theme?.chip ?? "border-border/70 bg-muted/70 text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/70")}>
                                    {progressText}
                                </span>
                                {completed ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 sm:text-[11px]">
                                        <CheckCircle2 className="h-3 w-3" />
                                        已收藏完成
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-600 dark:text-slate-300 sm:text-xs">
                                {SERIES_COPY[seriesKey] ?? "这一组徽章记录了同一方向上的进展。"}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                        {showList.map((badge) => (
                            <BadgeCard key={badge.id} badge={badge} isUnlocked={unlockedBadges.has(badge.id)} seriesStatus={seriesStatus} />
                        ))}
                    </div>
                </section>
            );
        }).filter(Boolean);

        if (sections.length === 0) return null;

        return <div className="space-y-4 sm:space-y-5">{sections}</div>;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children || <Button variant="outline">查看所有徽章</Button>}</DialogTrigger>
            <DialogContent className="flex h-[80vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-sm p-0 sm:rounded-xs [&>button]:hidden">
                <DialogHeader className="shrink-0 p-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        徽章图鉴
                        <span className="ml-auto text-xs font-normal text-muted-foreground sm:ml-2 sm:text-sm">
                            {unlockedList.length}/{badges.length}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="all" className="flex flex-1 flex-col overflow-hidden">
                    <div className="shrink-0 border-b px-4">
                        <TabsList className="w-full justify-between bg-transparent p-0 sm:justify-start sm:gap-6">
                            <TabsTrigger
                                value="all"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                全部 <span className="ml-1 text-muted-foreground">{badges.length}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="unlocked"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                已拥有 <span className="ml-1 text-muted-foreground">{unlockedList.length}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="locked"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                未解锁 <span className="ml-1 text-muted-foreground">{lockedList.length}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 bg-muted/10 p-3 sm:p-6">
                        <TabsContent value="all" className="mt-0">
                            {renderGroupedGrid(badges, "all")}
                        </TabsContent>
                        <TabsContent value="unlocked" className="mt-0">
                            {unlockedList.length > 0 ? (
                                renderGroupedGrid(unlockedList, "unlocked")
                            ) : (
                                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                                    <div className="mb-4 text-4xl">🌱</div>
                                    <p className="text-sm">还没有获得徽章</p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="locked" className="mt-0">
                            {lockedList.length > 0 ? (
                                renderGroupedGrid(lockedList, "locked")
                            ) : (
                                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                                    <p className="text-sm">已解锁全部展示的徽章</p>
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
                
                {/* Mobile Close Button (Optional, if we removed the top one) */}
                {/* For now we rely on clicking outside or native behavior if user wanted 'x' gone */}
            </DialogContent>
        </Dialog>
    );
}
