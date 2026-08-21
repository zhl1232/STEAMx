import { Award, ArrowRightLeft, Check, CheckCircle2, ChevronRight, Loader2, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { BadgeDisplay, BadgeTier, UserStats } from "@/lib/gamification/types";
import {
    getNextSeriesThreshold,
    getSeriesLabel,
    getSeriesProgressValue,
    getSeriesThresholds,
    getVisibleSeriesBadges,
    isSeriesAtVisibleMax,
    TIER_RANK,
} from "@/lib/gamification/badges";
import { buildInsectObservationProgress } from "@/lib/gamification/species-difficulty";
import { FEATURED_BADGE_LIMIT, resolveFeaturedBadges } from "@/lib/gamification/honorifics";
import { BadgeIcon } from "./badge-icon";
import { BadgeTierPill } from "./badge-tier-pill";

const SERIES_COPY: Partial<Record<string, string>> = {
    intro_likes: "为优秀作品送出鼓励，点亮每一次灵感共鸣与互动热度。",
    intro_publish: "将奇思妙想付诸实践，持续输出并分享你的精彩创作。",
    intro_collections: "收藏探索灵感与典藏作品，打造专属的创意知识库。",
    science_expert: "探索科学原理与自然奥秘，完成科学实验与自然观察积累成长。",
    tech_expert: "掌握代码与数字逻辑，完成编程项目与 Scratch 课时积累成长。",
    engineering_expert: "探索工程结构与搭建奥秘，完成工程类项目与积木课时积累成长。",
    art_expert: "释放视觉与审美创造力，完成艺术创作与课时作品积累成长。",
    math_expert: "锻炼逻辑思维与数理模型，完成数学挑战与博弈课时积累成长。",
    social: "与创作者积极交流探讨，通过留言与回复活跃社区氛围。",
    popularity: "创作优质作品与精辟见解，收获来自全社区的赞赏与认可。",
    milestone: "记录在探索道路上的每一次突破，见证长期的造物里程碑。",
    level: "积累探索经验与智慧，不断突破自我，迈向更高的创作者境界。",
    challenge: "积极投身主题挑战与限时竞赛，在实战中淬炼综合技能。",
    streak: "保持探索热情与学习习惯，持之以恒，见证时间的复利。",
    bird_observer: "在自然中敏锐观察与记录，提交审核通过的物种探索发现。",
    species_collector: "广泛探索大自然的多样生命，点亮鸟类、昆虫与植物图鉴名录。",
    bird_common: "探索身边的常见鸟类，发现羽翼间的自然之美。",
    bird_uncommon: "寻访林间与湿地的进阶鸟种，拓展观鸟视野。",
    bird_rare: "偶遇珍稀罕见的珍禽飞羽，记录难能可贵的自然奇观。",
    insect_rank: "参与昆虫生态探索九宫格，集齐分类图谱晋升昆虫专家。",
    playground_explorer: "体验丰富多元的益智游戏，全面拓宽思维边界。",
    playground_victories: "在益智对决与烧脑关卡中屡战屡胜，铸就游乐场传奇战绩。",
    first_steps: "迈向探索之旅的第一步，开启无限可能的创造世界。",
    playground_star: "极限思维与速度挑战，达成极高纪录方可解锁的荣耀彩蛋。",
    rare: "见证平台重大里程碑与卓越贡献的珍贵纪念徽章。",
};

const BIRD_SERIES = new Set(["bird_common", "bird_uncommon", "bird_rare"]);

function getProgressUnit(seriesKey: string) {
    if (seriesKey === "level") return "级";
    if (seriesKey === "streak") return "天";
    if (seriesKey === "social") return "条";
    if (seriesKey === "challenge" || seriesKey === "intro_likes" || seriesKey === "playground_victories") return "次";
    if (
        [
            "intro_publish",
            "intro_collections",
            "science_expert",
            "tech_expert",
            "engineering_expert",
            "art_expert",
            "math_expert",
            "popularity",
            "milestone",
            "playground_explorer",
        ].includes(seriesKey)
    ) return "个";
    if (BIRD_SERIES.has(seriesKey) || seriesKey === "species_collector") return "种";
    if (seriesKey === "bird_observer") return "条";
    if (seriesKey === "insect_rank") return "阶";
    return "";
}

function getBadgeThreshold(seriesKey: string, badge: BadgeDisplay) {
    if (!badge.tier) return null;
    return getSeriesThresholds(seriesKey)[TIER_RANK[badge.tier]] ?? null;
}

export function BadgeDetailDialog({
    open,
    onOpenChange,
    seriesKey,
    seriesBadges,
    displayBadge,
    unlockedIds,
    userStats,
    seriesCopy,
    allBadges,
    featuredBadgeIds,
    canManageHonors = true,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    seriesKey: string;
    seriesBadges: BadgeDisplay[];
    displayBadge: BadgeDisplay;
    unlockedIds: Set<string>;
    userStats?: UserStats | null;
    seriesCopy?: Partial<Record<string, string>>;
    allBadges: BadgeDisplay[];
    featuredBadgeIds?: string[] | null;
    canManageHonors?: boolean;
}) {
    const { user, profile, refreshProfile } = useAuth();
    const { toast } = useToast();
    const [savingHonor, setSavingHonor] = useState(false);
    const [featuredIdsOverride, setFeaturedIdsOverride] = useState<string[] | null | undefined>(undefined);
    const [replacementOpen, setReplacementOpen] = useState(false);
    const [replacementIndex, setReplacementIndex] = useState<number | null>(null);

    // 支持在弹窗内部点击升级路线切换选中的徽章
    const [activeBadgeId, setActiveBadgeId] = useState<string>(displayBadge.id);

    useEffect(() => {
        setActiveBadgeId(displayBadge.id);
    }, [displayBadge.id, open]);

    const visibleBadges = getVisibleSeriesBadges(seriesBadges, unlockedIds);
    const activeBadge = visibleBadges.find((b) => b.id === activeBadgeId) ?? displayBadge;

    const isUnlocked = unlockedIds.has(activeBadge.id);
    const copy = (seriesCopy ?? SERIES_COPY)[seriesKey] ?? "这一组徽章记录了你在该方向上的探索与成长。";
    const current = getSeriesProgressValue(seriesKey, userStats);
    const next = current === null ? null : getNextSeriesThreshold(seriesKey, current, unlockedIds);
    const atMax = current !== null && isSeriesAtVisibleMax(seriesKey, current, unlockedIds);
    const unit = getProgressUnit(seriesKey);
    const badgeThreshold = getBadgeThreshold(seriesKey, activeBadge);
    const badgeRequirementMet = current !== null && badgeThreshold !== null && current >= badgeThreshold;
    const badgeAchieved = isUnlocked || badgeRequirementMet;

    const nextBadge = next === null
        ? null
        : visibleBadges.find((badge) => getBadgeThreshold(seriesKey, badge) === next) ?? null;

    // 进度目标：若当前查看的徽章未达成，则目标为当前徽章；若已达成，则目标为下一档
    const progressTargetBadge = current !== null && !badgeAchieved
        ? activeBadge
        : nextBadge;
    const progressTarget = progressTargetBadge
        ? getBadgeThreshold(seriesKey, progressTargetBadge)
        : next;

    const insectProgress = userStats?.observedInsectSlugs
        ? buildInsectObservationProgress(userStats.observedInsectSlugs)
        : null;

    const profileFeaturedBadgeIds = featuredBadgeIds !== undefined
        ? featuredBadgeIds
        : canManageHonors
            ? profile?.featured_badge_ids
            : null;
    const resolvedFeaturedBadgeIds = featuredIdsOverride !== undefined
        ? featuredIdsOverride
        : profileFeaturedBadgeIds;
    const featuredSelection = resolveFeaturedBadges({
        featuredBadgeIds: resolvedFeaturedBadgeIds,
        unlockedBadgeIds: unlockedIds,
        allBadges,
    });
    const featuredBadges = featuredSelection.badges;
    const featuredList = featuredBadges.map((badge) => badge.id);
    const featuredPosition = featuredList.indexOf(activeBadge.id);
    const isFeatured = featuredPosition >= 0;
    const isEquippedTitle = profile?.equipped_title === activeBadge.name;

    const handleToggleTitle = async () => {
        if (!user || !canManageHonors || savingHonor || !badgeAchieved) return;
        setSavingHonor(true);
        try {
            const nextTitle = isEquippedTitle ? null : activeBadge.name;
            const res = await fetch("/api/profile/equipped-honor", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ equipped_title: nextTitle }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "佩戴失败");
            await refreshProfile();
            toast({
                title: nextTitle ? `已佩戴称号「${nextTitle}」` : "已卸下称号，恢复系统推荐",
            });
        } catch (error) {
            toast({
                title: "操作失败",
                description: error instanceof Error ? error.message : "请稍后重试",
                variant: "destructive",
            });
        } finally {
            setSavingHonor(false);
        }
    };

    const saveFeaturedBadgeIds = async (nextFeatured: string[], successTitle: string) => {
        if (!user || !canManageHonors || savingHonor) return;
        setSavingHonor(true);
        try {
            const res = await fetch("/api/profile/equipped-honor", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featured_badge_ids: nextFeatured }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "设置失败");
            await refreshProfile();
            setFeaturedIdsOverride(nextFeatured);
            toast({
                title: successTitle,
            });
            return true;
        } catch (error) {
            toast({
                title: "操作失败",
                description: error instanceof Error ? error.message : "请稍后重试",
                variant: "destructive",
            });
            return false;
        } finally {
            setSavingHonor(false);
        }
    };

    const handleWearFeatured = () => {
        if (!user || !canManageHonors || savingHonor || !badgeAchieved) return;
        if (featuredBadges.length >= FEATURED_BADGE_LIMIT) {
            setReplacementIndex(null);
            setReplacementOpen(true);
            return;
        }

        void saveFeaturedBadgeIds(
            [...featuredList, activeBadge.id],
            `「${activeBadge.name}」已佩戴到主页`,
        );
    };

    const handleRemoveFeatured = () => {
        if (!user || !canManageHonors || savingHonor) return;
        void saveFeaturedBadgeIds(
            featuredList.filter((id) => id !== activeBadge.id),
            `已将「${activeBadge.name}」从主页卸下`,
        );
    };

    const handleReplaceFeatured = async () => {
        if (!user || !canManageHonors || savingHonor) return;
        if (replacementIndex === null) return;
        const nextFeatured = [...featuredList];
        nextFeatured[replacementIndex] = activeBadge.id;
        const saved = await saveFeaturedBadgeIds(nextFeatured, `已将主页徽章替换为「${activeBadge.name}」`);
        if (saved) {
            setReplacementOpen(false);
            setReplacementIndex(null);
        }
    };

    const progressPercentage = current !== null && progressTarget !== null && progressTarget > 0
        ? Math.min(100, Math.round((current / progressTarget) * 100))
        : 0;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl backdrop-blur-md">
                    {/* 对话框头部 */}
                    <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/20 px-5 py-3.5 sm:px-6">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <DialogTitle className="text-base font-bold sm:text-lg">
                                {getSeriesLabel(seriesKey)}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    {/* 主体两栏布局：左侧聚焦当前徽章与操作，右侧晋升路线 */}
                    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:grid-cols-[minmax(0,290px)_minmax(0,1fr)] sm:gap-6 sm:p-6">
                        {/* 左侧：徽章大图、简介、目标进度与个性化荣誉操作 */}
                        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                            {/* 徽章高光台 */}
                            <div className="relative mx-auto flex w-full flex-col items-center sm:mx-0 sm:items-start">
                                <div className="relative flex items-center justify-center p-3">
                                    <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl dark:bg-primary/20" />
                                    <BadgeIcon
                                        icon={activeBadge.icon}
                                        tier={activeBadge.tier}
                                        seriesKey={activeBadge.seriesKey}
                                        size="xl"
                                        locked={!badgeAchieved}
                                        className="relative h-24 w-24 drop-shadow-md transition-transform duration-300 hover:scale-105 sm:h-28 sm:w-28"
                                    />
                                </div>

                                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                    <h3 className="text-lg font-bold text-foreground sm:text-xl">{activeBadge.name}</h3>
                                    {activeBadge.tier ? <BadgeTierPill tier={activeBadge.tier} className="text-xs px-2 py-0.5" /> : null}
                                </div>

                                <p className="mt-1 text-xs font-medium text-muted-foreground">{activeBadge.description}</p>
                                <DialogDescription className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                                    {copy}
                                </DialogDescription>
                            </div>

                            {/* 目标进度卡片 */}
                            {current !== null && progressTarget !== null ? (
                                <div className="mt-4 w-full rounded-md border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-3.5 text-left shadow-2xs backdrop-blur-xs sm:rounded-lg">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-semibold text-primary">
                                                {badgeAchieved ? "下一档目标" : "解锁条件"}
                                            </div>
                                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground">
                                                <span className="truncate">{progressTargetBadge?.name ?? "下一档"}</span>
                                                {progressTargetBadge?.tier ? <BadgeTierPill tier={progressTargetBadge.tier} /> : null}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right leading-tight">
                                            <div className="text-sm font-extrabold tabular-nums text-primary">
                                                {current} <span className="text-xs font-normal text-muted-foreground">/ {progressTarget}</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-muted-foreground">{progressPercentage}%</span>
                                        </div>
                                    </div>

                                    {/* 进度条 */}
                                    <div
                                        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-primary/15"
                                        role="progressbar"
                                        aria-label={`${progressTargetBadge?.name ?? "下一档"}进度`}
                                        aria-valuemin={0}
                                        aria-valuemax={progressTarget}
                                        aria-valuenow={Math.min(current, progressTarget)}
                                    >
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                                            style={{ width: `${progressPercentage}%` }}
                                        />
                                    </div>

                                    <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-primary">
                                        <span>
                                            {badgeAchieved ? "距离目标还差 " : "距离解锁还差 "}
                                            <strong className="font-bold tabular-nums text-foreground">{Math.max(0, progressTarget - current)}</strong>
                                            {unit ? ` ${unit}` : ""}
                                        </span>
                                    </div>
                                </div>
                            ) : current !== null && atMax ? (
                                <div className="mt-4 w-full rounded-md border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3.5 text-left shadow-2xs sm:rounded-lg">
                                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        <span>已完成全部档位</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        累计总进度已达 <strong className="font-semibold text-foreground">{current}</strong>{unit ? ` ${unit}` : ""}
                                    </p>
                                </div>
                            ) : null}

                            {/* 荣誉配置管理区（单行并排布局，圆角与风格一致） */}
                            {canManageHonors && user ? (
                                <div className="mt-3.5 w-full pt-1">
                                    {badgeAchieved ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* 称号操作按钮 */}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isEquippedTitle ? "secondary" : "outline"}
                                                disabled={savingHonor}
                                                onClick={handleToggleTitle}
                                                className="h-8 w-full justify-center gap-1.5 rounded-md px-2 text-xs font-medium"
                                            >
                                                {savingHonor ? (
                                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                                ) : isEquippedTitle ? (
                                                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                ) : (
                                                    <Award className="h-3.5 w-3.5 shrink-0 text-primary" />
                                                )}
                                                <span className="truncate">
                                                    {isEquippedTitle ? "已戴称号" : "设为称号"}
                                                </span>
                                            </Button>

                                            {/* 主页徽章展示操作 */}
                                            {isFeatured ? (
                                                <div className="flex h-8 min-w-0 items-center justify-between gap-1.5 rounded-md border border-amber-300/60 bg-amber-50/80 px-2.5 dark:border-amber-500/25 dark:bg-amber-500/10">
                                                    <div
                                                        role="status"
                                                        aria-label={`${activeBadge.name}已佩戴`}
                                                        className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                                                    >
                                                        <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
                                                        <span className="truncate leading-none">已佩戴</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={savingHonor}
                                                        onClick={handleRemoveFeatured}
                                                        className="inline-flex h-5.5 shrink-0 items-center justify-center rounded px-1.5 text-xs font-medium text-amber-900/70 transition-colors hover:bg-amber-200/50 hover:text-destructive focus-visible:outline-hidden disabled:opacity-50 dark:text-amber-300/70 dark:hover:bg-amber-900/40 dark:hover:text-destructive"
                                                        title="从主页卸下"
                                                    >
                                                        卸下
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={savingHonor}
                                                    onClick={handleWearFeatured}
                                                    className="h-8 w-full justify-center gap-1.5 rounded-md px-2 text-xs font-medium"
                                                >
                                                    {savingHonor ? (
                                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                                    ) : featuredBadges.length >= FEATURED_BADGE_LIMIT ? (
                                                        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                    ) : (
                                                        <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                    )}
                                                    <span className="truncate">
                                                        {featuredBadges.length >= FEATURED_BADGE_LIMIT
                                                            ? "替换佩戴"
                                                            : "佩戴到主页"}
                                                    </span>
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-center text-[11px] text-muted-foreground sm:text-left">
                                            达成条件并解锁后，可设为称号或佩戴到主页。
                                        </p>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        {/* 右侧：升级路线（里程碑晋升阶梯） */}
                        <div className="flex flex-col space-y-3">
                            {visibleBadges.some((badge) => badge.tier) ? (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            晋阶成长路线
                                        </h4>
                                        <span className="text-[11px] text-muted-foreground">
                                            点击档位可查看详情
                                        </span>
                                    </div>

                                    <ol className="space-y-1.5 sm:space-y-2">
                                        {visibleBadges.map((badge, idx) => {
                                            const done = unlockedIds.has(badge.id);
                                            const isSelected = badge.id === activeBadge.id;
                                            const featuredBadgePosition = featuredList.indexOf(badge.id);
                                            const requirementMet = current !== null && (getBadgeThreshold(seriesKey, badge) ?? Number.POSITIVE_INFINITY) <= current;
                                            const achieved = done || requirementMet;
                                            const isNext = !achieved && nextBadge?.id === badge.id;

                                            return (
                                                <li key={badge.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveBadgeId(badge.id)}
                                                        className={cn(
                                                            "group relative flex w-full items-center gap-2.5 rounded-sm border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 sm:rounded-md",
                                                            isSelected
                                                                ? "border-primary/60 bg-primary/[0.05] shadow-xs ring-1 ring-primary/30"
                                                                : achieved
                                                                    ? "border-emerald-500/20 bg-emerald-50/40 hover:border-emerald-500/40 dark:bg-emerald-950/15"
                                                                    : "border-border/60 bg-background/60 opacity-80 hover:border-border hover:opacity-100",
                                                        )}
                                                        aria-current={isSelected ? "true" : undefined}
                                                    >
                                                        {/* 左侧状态标识 */}
                                                        <div className="shrink-0">
                                                            {achieved ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                            ) : isNext ? (
                                                                <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-primary/20">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                </div>
                                                            ) : (
                                                                <div className="flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] font-bold text-muted-foreground/60">
                                                                    {idx + 1}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 中间信息 */}
                                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                            <span className={cn("truncate text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
                                                                {badge.name}
                                                            </span>
                                                            {badge.tier ? <BadgeTierPill tier={badge.tier as BadgeTier} /> : null}
                                                        </div>

                                                        {/* 状态徽标 */}
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            {featuredBadgePosition >= 0 ? (
                                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                                                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                                                    主页
                                                                </span>
                                                            ) : null}

                                                            {isSelected ? (
                                                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                                                    当前
                                                                </span>
                                                            ) : null}

                                                            {done ? (
                                                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    已解锁
                                                                </span>
                                                            ) : requirementMet ? (
                                                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    已达成
                                                                </span>
                                                            ) : isNext ? (
                                                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                                                    下一档
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        <ChevronRight className={cn(
                                                            "h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5",
                                                            isSelected && "text-primary/70"
                                                        )} />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            ) : (
                                <div className="rounded-md border border-border/70 bg-muted/20 p-4 sm:rounded-lg">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">成就说明</h4>
                                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{activeBadge.description}</p>
                                </div>
                            )}

                            {/* 昆虫九宫格等特殊挑战路线 */}
                            {seriesKey === "insect_rank" && insectProgress ? (
                                <div className="pt-2">
                                    <InsectDetailProgress
                                        progress={insectProgress}
                                        diamondUnlocked={unlockedIds.has("insect_rank_diamond")}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 替换主页徽章的弹窗 */}
            <Dialog
                open={replacementOpen}
                onOpenChange={(nextOpen) => {
                    setReplacementOpen(nextOpen);
                    if (!nextOpen) setReplacementIndex(null);
                }}
            >
                <DialogContent className="w-[92vw] max-w-md rounded-2xl p-0 shadow-2xl">
                    <DialogHeader className="border-b border-border/60 bg-muted/20 px-5 py-4 text-left">
                        <DialogTitle className="text-base font-bold sm:text-lg">选择要替换的徽章</DialogTitle>
                        <DialogDescription className="text-xs leading-5 text-muted-foreground">
                            主页已经佩戴 {FEATURED_BADGE_LIMIT} 枚徽章。选择一枚后，新的「{activeBadge.name}」会放在它原来的位置。
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4 sm:p-5">
                        {featuredBadges.map((badge, index) => (
                            <button
                                key={badge.id}
                                type="button"
                                disabled={savingHonor}
                                onClick={() => setReplacementIndex(index)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-md border bg-background/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-60 sm:rounded-lg",
                                    replacementIndex === index
                                        ? "border-primary bg-primary/[0.08] ring-2 ring-primary/20"
                                        : "border-border/70",
                                )}
                                aria-label={`替换第 ${index + 1} 枚：${badge.name}`}
                                aria-pressed={replacementIndex === index}
                            >
                                <BadgeIcon
                                    icon={badge.icon}
                                    tier={badge.tier}
                                    seriesKey={badge.seriesKey}
                                    size="sm"
                                    showGlow
                                    className="h-10 w-10 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-semibold text-muted-foreground">
                                        主页第 {index + 1} 枚
                                    </span>
                                    <span className="block truncate text-sm font-bold text-foreground">
                                        {badge.name}
                                    </span>
                                </div>
                                <ArrowRightLeft className={cn(
                                    "h-4 w-4 shrink-0",
                                    replacementIndex === index ? "text-primary" : "text-muted-foreground/50"
                                )} />
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-3.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReplacementOpen(false)} disabled={savingHonor}>
                            取消
                        </Button>
                        <Button type="button" size="sm" onClick={() => void handleReplaceFeatured()} disabled={replacementIndex === null || savingHonor}>
                            {savingHonor ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            确认替换
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function InsectDetailProgress({
    progress,
    diamondUnlocked,
}: {
    progress: ReturnType<typeof buildInsectObservationProgress>;
    diamondUnlocked: boolean;
}) {
    const nextRank = (["D", "C", "B", "A"] as const).find((rank) => !progress.completedRanks.includes(rank));
    const grids = nextRank
        ? progress.grids.filter((grid) => grid.rank === nextRank)
        : progress.grids.filter((grid) => grid.rank === "A");
    const completedChallenges = progress.challenges.filter((challenge) => challenge.complete && !challenge.mythic);
    const showMythic = progress.mythicRevealed;

    return (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3.5">
            {nextRank ? (
                <div className="text-xs font-medium text-foreground">
                    集齐一套【{grids.map((grid) => grid.title).join(" / ")}】，解锁【{
                        { D: "初识虫趣", C: "寻虫常客", B: "寻虫能手", A: "虫林专家" }[nextRank]
                    }】
                </div>
            ) : null}
            <div className="grid gap-2.5 sm:grid-cols-2">
                {grids.map((grid) => (
                    <div key={grid.id} className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                            <span>{grid.title}</span>
                            <span className="text-[11px] text-muted-foreground">{grid.found} / {grid.total}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {grid.cells.map((cell) => (
                                <div
                                    key={cell.slug}
                                    className={cn(
                                        "rounded px-1 py-1 text-center text-[10px] font-medium leading-4",
                                        cell.found
                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                            : "bg-muted/70 text-muted-foreground",
                                    )}
                                >
                                    {cell.name}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {diamondUnlocked && completedChallenges.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                    {completedChallenges.map((challenge) => (
                        <div key={challenge.id} className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>已完成专属挑战 · {challenge.title}（{challenge.found}/{challenge.total}）</span>
                        </div>
                    ))}
                </div>
            ) : null}
            {showMythic ? (
                <div className="rounded-lg border border-violet-300/60 bg-violet-50/50 p-2.5 dark:border-violet-500/25 dark:bg-violet-950/20">
                    <div className="mb-2 text-xs font-bold text-violet-900 dark:text-violet-200">
                        北京神物探索 · {progress.mythicObservedCount}/7
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {progress.challenges.find((item) => item.id === "mythic")?.cells.map((cell) => (
                            <div
                                key={cell.slug}
                                className={cn(
                                    "rounded px-1.5 py-1 text-[10px] font-medium",
                                    cell.found ? "bg-violet-500/20 text-violet-900 dark:text-violet-200" : "bg-muted/60 text-muted-foreground",
                                )}
                            >
                                {cell.name}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export { SERIES_COPY };
