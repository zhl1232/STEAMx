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
const TIER_LABELS: Record<BadgeTier, string> = {
    bronze: "铜",
    silver: "银",
    gold: "金",
    platinum: "白金",
};
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
    milestone: "持续完成项目带来的长期里程碑。",
    level: "等级增长对应的整体成长轨迹。",
    challenge: "参与挑战赛，进入更明确的目标场景。",
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
    bird_observation: "偏自然观察与记录的户外成就线。",
    rare: "限定、纪念或人工授予的特别徽章。",
};

const SERIES_THEME: Partial<Record<string, { section: string; chip: string }>> = {
    intro_likes: { section: "border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_42%),linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,0.94))]", chip: "border-amber-200/70 bg-amber-50/90 text-amber-700" },
    intro_publish: { section: "border-sky-200/60 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_42%),linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.94))]", chip: "border-sky-200/70 bg-sky-50/90 text-sky-700" },
    intro_collections: { section: "border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.94))]", chip: "border-emerald-200/70 bg-emerald-50/90 text-emerald-700" },
    science_expert: { section: "border-cyan-200/60 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_40%),linear-gradient(180deg,rgba(236,254,255,0.92),rgba(255,255,255,0.94))]", chip: "border-cyan-200/70 bg-cyan-50/90 text-cyan-700" },
    tech_expert: { section: "border-indigo-200/60 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.14),transparent_42%),linear-gradient(180deg,rgba(238,242,255,0.92),rgba(255,255,255,0.94))]", chip: "border-indigo-200/70 bg-indigo-50/90 text-indigo-700" },
    engineering_expert: { section: "border-orange-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_42%),linear-gradient(180deg,rgba(255,247,237,0.92),rgba(255,255,255,0.94))]", chip: "border-orange-200/70 bg-orange-50/90 text-orange-700" },
    art_expert: { section: "border-pink-200/60 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.12),transparent_42%),linear-gradient(180deg,rgba(253,242,248,0.92),rgba(255,255,255,0.94))]", chip: "border-pink-200/70 bg-pink-50/90 text-pink-700" },
    math_expert: { section: "border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.94))]", chip: "border-emerald-200/70 bg-emerald-50/90 text-emerald-700" },
    social: { section: "border-fuchsia-200/60 bg-[radial-gradient(circle_at_top_left,rgba(192,132,252,0.12),transparent_42%),linear-gradient(180deg,rgba(250,245,255,0.92),rgba(255,255,255,0.94))]", chip: "border-fuchsia-200/70 bg-fuchsia-50/90 text-fuchsia-700" },
    popularity: { section: "border-rose-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.12),transparent_42%),linear-gradient(180deg,rgba(255,241,242,0.92),rgba(255,255,255,0.94))]", chip: "border-rose-200/70 bg-rose-50/90 text-rose-700" },
    milestone: { section: "border-yellow-200/60 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_42%),linear-gradient(180deg,rgba(254,252,232,0.92),rgba(255,255,255,0.94))]", chip: "border-yellow-200/70 bg-yellow-50/90 text-yellow-700" },
    level: { section: "border-violet-200/60 bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.14),transparent_42%),linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.94))]", chip: "border-violet-200/70 bg-violet-50/90 text-violet-700" },
    challenge: { section: "border-orange-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_42%),linear-gradient(180deg,rgba(255,247,237,0.92),rgba(255,255,255,0.94))]", chip: "border-orange-200/70 bg-orange-50/90 text-orange-700" },
    streak: { section: "border-red-200/60 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_42%),linear-gradient(180deg,rgba(254,242,242,0.92),rgba(255,255,255,0.94))]", chip: "border-red-200/70 bg-red-50/90 text-red-700" },
    bird_observer: { section: "border-teal-200/60 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_42%),linear-gradient(180deg,rgba(240,253,250,0.92),rgba(255,255,255,0.94))]", chip: "border-teal-200/70 bg-teal-50/90 text-teal-700" },
    species_collector: { section: "border-lime-200/60 bg-[radial-gradient(circle_at_top_left,rgba(134,239,172,0.14),transparent_42%),linear-gradient(180deg,rgba(247,254,231,0.92),rgba(255,255,255,0.94))]", chip: "border-lime-200/70 bg-lime-50/90 text-lime-700" },
    first_steps: { section: "border-violet-200/60 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.12),transparent_42%),linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.94))]", chip: "border-violet-200/70 bg-violet-50/90 text-violet-700" },
    minesweeper: { section: "border-zinc-300/70 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.12),transparent_40%),linear-gradient(180deg,rgba(250,250,250,0.94),rgba(255,255,255,0.96))]", chip: "border-zinc-300/80 bg-zinc-50/90 text-zinc-700" },
    gomoku: { section: "border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_40%),linear-gradient(180deg,rgba(255,251,235,0.94),rgba(255,255,255,0.96))]", chip: "border-amber-200/70 bg-amber-50/90 text-amber-700" },
    game2048: { section: "border-yellow-200/60 bg-[radial-gradient(circle_at_top_left,rgba(253,224,71,0.14),transparent_40%),linear-gradient(180deg,rgba(254,252,232,0.94),rgba(255,255,255,0.96))]", chip: "border-yellow-200/70 bg-yellow-50/90 text-yellow-700" },
    game24: { section: "border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_40%),linear-gradient(180deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96))]", chip: "border-emerald-200/70 bg-emerald-50/90 text-emerald-700" },
    life: { section: "border-lime-200/60 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.14),transparent_40%),linear-gradient(180deg,rgba(247,254,231,0.94),rgba(255,255,255,0.96))]", chip: "border-lime-200/70 bg-lime-50/90 text-lime-700" },
    hanoi: { section: "border-orange-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_40%),linear-gradient(180deg,rgba(255,247,237,0.94),rgba(255,255,255,0.96))]", chip: "border-orange-200/70 bg-orange-50/90 text-orange-700" },
    sudoku: { section: "border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_40%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.96))]", chip: "border-slate-200/80 bg-slate-50/90 text-slate-700" },
    nqueens: { section: "border-violet-200/60 bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.12),transparent_40%),linear-gradient(180deg,rgba(245,243,255,0.94),rgba(255,255,255,0.96))]", chip: "border-violet-200/70 bg-violet-50/90 text-violet-700" },
    circuit: { section: "border-cyan-200/60 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_40%),linear-gradient(180deg,rgba(236,254,255,0.94),rgba(255,255,255,0.96))]", chip: "border-cyan-200/70 bg-cyan-50/90 text-cyan-700" },
    bird_observation: { section: "border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.14),transparent_40%),linear-gradient(180deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96))]", chip: "border-emerald-200/70 bg-emerald-50/90 text-emerald-700" },
    rare: { section: "border-pink-200/60 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.12),transparent_42%),linear-gradient(180deg,rgba(253,242,248,0.94),rgba(255,255,255,0.96))]", chip: "border-pink-200/70 bg-pink-50/90 text-pink-700" },
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

/** 阶梯系列只展示一枚：该系列已解锁的最高档，若都未解锁则展示铜档 */
function pickBadgePerTieredSeries(
    seriesList: Badge[],
    unlockedBadges: Set<string>,
    mode: GalleryMode
): Badge[] {
    if (seriesList.length !== 4 || !seriesList.every((b) => b.tier)) return seriesList;
    const unlocked = seriesList.filter((b) => unlockedBadges.has(b.id));
    if (mode === "unlocked") {
        if (unlocked.length === 0) return [];
        const highestUnlocked = unlocked.reduce((a, b) =>
            TIER_ORDER[a.tier!] > TIER_ORDER[b.tier!] ? a : b
        );
        return [highestUnlocked];
    }

    if (mode === "locked") {
        if (unlocked.length === 0) return [seriesList[0]];
        const highestUnlocked = unlocked.reduce((a, b) =>
            TIER_ORDER[a.tier!] > TIER_ORDER[b.tier!] ? a : b
        );
        const nextTier = seriesList.find((badge) => TIER_ORDER[badge.tier!] > TIER_ORDER[highestUnlocked.tier!]);
        return nextTier ? [nextTier] : [];
    }

    if (unlocked.length === 0) return [seriesList[0]];
    const highestUnlocked = unlocked.reduce((a, b) =>
        TIER_ORDER[a.tier!] > TIER_ORDER[b.tier!] ? a : b
    );
    return [highestUnlocked];
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
    return badge.description.replace(/^首次/, "完成首次").replace(/^累计/, "还需累计").replace(/^达到/, "达到");
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
            : seriesStatus.nextBadge?.tier
                ? `下一档 ${TIER_LABELS[seriesStatus.nextBadge.tier]}`
                : "下一档待解锁";
    }

    if (!seriesStatus.highestUnlockedBadge?.tier) {
        return "尚未达成";
    }

    if (seriesStatus.completed) {
        return `${TIER_LABELS[seriesStatus.highestUnlockedBadge.tier]}已达成`;
    }

    return `当前${TIER_LABELS[seriesStatus.highestUnlockedBadge.tier]}级`;
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
                        className={`
                            relative overflow-hidden rounded-xl border p-2 sm:p-3 flex flex-col items-center text-center gap-1.5 sm:gap-2
                            transition-all duration-200 group h-full cursor-pointer hover:shadow-md
                            ${isUnlocked
                                ? "bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 border-white/20 shadow-sm"
                                : "bg-muted/30 border-muted opacity-80"
                            }
                        `}
                    >
                        <div className="flex justify-center p-1 sm:p-2">
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
                                "font-semibold text-[10px] sm:text-sm line-clamp-1",
                                isUnlocked ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {badge.name}
                            </div>
                            {/* Hide description on mobile for cleaner look */}
                            <div className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 leading-tight">
                                {badge.description}
                            </div>
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 p-2" align="center">
                    <DropdownMenuLabel className="flex justify-between items-center">
                        <span>{badge.name}</span>
                        {isUnlocked && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">已获得</span>}
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

            const displayList = pickBadgePerTieredSeries(fullSeries, unlockedBadges, mode);
            const showList = displayList.filter((badge) => visibleIds.has(badge.id));
            if (showList.length === 0) return null;

            const seriesStatus = getSeriesStatus(fullSeries, unlockedBadges);
            const { completed } = seriesStatus;
            const progressText = getSeriesProgressText(seriesStatus, mode);
            const theme = SERIES_THEME[seriesKey];

            return (
                <section
                    key={seriesKey}
                    className={cn(
                        "relative rounded-[24px] border p-3 shadow-sm sm:p-4",
                        "backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]",
                        theme?.section ?? "border-border/60 bg-background/95"
                    )}
                >
                    {completed ? (
                        <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-emerald-200/80 bg-emerald-50/95 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            COLLECTED
                        </div>
                    ) : null}
                    <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{label}</h3>
                                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-white/70", theme?.chip ?? "border-border/70 bg-muted/70 text-muted-foreground")}>
                                    {progressText}
                                </span>
                                {completed ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 sm:text-[11px]">
                                        <CheckCircle2 className="h-3 w-3" />
                                        已收藏完成
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground sm:text-xs">
                                {SERIES_COPY[seriesKey] ?? "这一组徽章记录了同一方向上的进展。"}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
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
            <DialogContent className="flex h-[80vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-lg [&>button]:hidden">
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
