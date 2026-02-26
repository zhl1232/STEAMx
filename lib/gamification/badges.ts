import { Badge, BadgeTier, UserStats } from "./types";

const TIER_RANK: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

export const BADGE_TIERS: BadgeTier[] = ["bronze", "silver", "gold", "platinum"];

const TIER_LABELS: Record<BadgeTier, string> = {
    bronze: "铜",
    silver: "银",
    gold: "金",
    platinum: "白金",
};

type TierThresholds = [number, number, number, number]; // [铜, 银, 金, 白金]

interface TieredSeriesConfig {
    seriesKey: string;
    getValue: (stats: UserStats) => number;
    thresholds: TierThresholds;
    label: string;
    icon: string;
    descriptionTemplate: (tier: BadgeTier, value: number) => string;
}

function buildTieredBadges(config: TieredSeriesConfig): Badge[] {
    const badges: Badge[] = [];
    const tiers: BadgeTier[] = ["bronze", "silver", "gold", "platinum"];
    tiers.forEach((tier, i) => {
        const value = config.thresholds[i];
        badges.push({
            id: `${config.seriesKey}_${tier}`,
            name: `${config.label} · ${TIER_LABELS[tier]}`,
            description: config.descriptionTemplate(tier, value),
            icon: config.icon,
            tier,
            seriesKey: config.seriesKey,
            kind: "tiered",
            condition: (stats) => config.getValue(stats) >= value,
        });
    });
    return badges;
}

const TIERED_SERIES: TieredSeriesConfig[] = [
    {
        seriesKey: "intro_likes",
        label: "点赞",
        icon: "thumbs_up",
        getValue: (s) => s.likesGiven,
        thresholds: [1, 50, 200, 1000],
        descriptionTemplate: (_, v) => `累计点赞 ${v} 次`,
    },

    {
        seriesKey: "intro_publish",
        label: "发布",
        icon: "share_2",
        getValue: (s) => s.projectsPublished,
        thresholds: [1, 5, 10, 50],
        descriptionTemplate: (_, v) => `累计发布 ${v} 个项目`,
    },
    {
        seriesKey: "intro_collections",
        label: "收藏",
        icon: "bookmark",
        getValue: (s) => s.collectionsCount,
        thresholds: [1, 50, 200, 1000],
        descriptionTemplate: (_, v) => `累计收藏 ${v} 个项目`,
    },
    {
        seriesKey: "science_expert",
        label: "科学专家",
        icon: "zap",
        getValue: (s) => s.scienceCompleted,
        thresholds: [3, 10, 20, 50],
        descriptionTemplate: (_, v) => `完成科学类项目 ${v} 个`,
    },
    {
        seriesKey: "tech_expert",
        label: "技术达人",
        icon: "code_2",
        getValue: (s) => s.techCompleted,
        thresholds: [3, 10, 20, 50],
        descriptionTemplate: (_, v) => `完成技术类项目 ${v} 个`,
    },
    {
        seriesKey: "engineering_expert",
        label: "工程师",
        icon: "pen_tool",
        getValue: (s) => s.engineeringCompleted,
        thresholds: [3, 10, 20, 50],
        descriptionTemplate: (_, v) => `完成工程类项目 ${v} 个`,
    },
    {
        seriesKey: "art_expert",
        label: "艺术家",
        icon: "palette",
        getValue: (s) => s.artCompleted,
        thresholds: [3, 10, 20, 50],
        descriptionTemplate: (_, v) => `完成艺术类项目 ${v} 个`,
    },
    {
        seriesKey: "math_expert",
        label: "数学家",
        icon: "calculator",
        getValue: (s) => s.mathCompleted,
        thresholds: [3, 10, 20, 50],
        descriptionTemplate: (_, v) => `完成数学类项目 ${v} 个`,
    },
    {
        seriesKey: "social",
        label: "社交达人",
        icon: "message_circle",
        getValue: (s) => s.commentsCount + s.repliesCount,
        thresholds: [1, 30, 150, 500],
        descriptionTemplate: (_, v) => `评论与回复合计 ${v} 条`,
    },
    {
        seriesKey: "popularity",
        label: "人气之星",
        icon: "heart",
        getValue: (s) => s.likesReceived,
        thresholds: [10, 100, 500, 2000],
        descriptionTemplate: (_, v) => `收到赞 ${v} 个`,
    },
    {
        seriesKey: "milestone",
        label: "成就里程碑",
        icon: "trophy",
        getValue: (s) => s.projectsCompleted,
        thresholds: [5, 20, 50, 100],
        descriptionTemplate: (_, v) => `完成项目 ${v} 个`,
    },
    {
        seriesKey: "level",
        label: "等级晋升",
        icon: "award",
        getValue: (s) => s.level,
        thresholds: [5, 20, 50, 100],
        descriptionTemplate: (_, v) => `达到等级 ${v}`,
    },
    {
        seriesKey: "challenge",
        label: "挑战赛",
        icon: "target",
        getValue: (s) => s.challengesJoined,
        thresholds: [2, 6, 15, 30],
        descriptionTemplate: (_, v) => `参加挑战赛 ${v} 次`,
    },
    {
        seriesKey: "streak",
        label: "连续打卡",
        icon: "flame",
        getValue: (s) => s.consecutiveDays,
        thresholds: [3, 7, 30, 90],
        descriptionTemplate: (_, v) => `连续登录 ${v} 天`,
    },
];

const TIERED_BADGES: Badge[] = TIERED_SERIES.flatMap(buildTieredBadges);

const SINGLE_BADGES: Badge[] = [
    { id: "first_step", name: "第一步", description: "完成注册账号", icon: "footprints", kind: "single", seriesKey: "first_steps", condition: () => true },
    { id: "explorer", name: "初级探索者", description: "完成 1 个项目", icon: "sparkles", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.projectsCompleted >= 1 },
    { id: "social_butterfly", name: "社交蝴蝶", description: "首次参与讨论", icon: "users", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.commentsCount >= 1 || stats.discussionsCreated >= 1 || stats.repliesCount >= 1 },
    { id: "challenge_rookie", name: "挑战新人", description: "首次参加挑战赛", icon: "flag", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.challengesJoined >= 1 },
    // 扫雷专属徽章
    { id: "minesweeper_rookie", name: "排雷新兵", description: "首次通关扫雷（任意难度）", icon: "bomb", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperWins >= 1 },
    { id: "minesweeper_expert", name: "排雷专家", description: "完成高级难度扫雷通关", icon: "shield", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperExpertWins >= 1 },
    { id: "minesweeper_speedster", name: "极速拆弹", description: "在 60 秒内通关扫雷（任意难度）", icon: "zap", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperBestTime > 0 && stats.minesweeperBestTime <= 60 },
];

const RARE_BADGES: Badge[] = [
    { id: "early_bird", name: "平台先驱", description: "前 100 名注册用户", icon: "rocket", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "bug_hunter", name: "漏洞猎人", description: "发现并报告平台 Bug", icon: "bug", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "contributor", name: "贡献者", description: "为平台做出特殊贡献", icon: "heart", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "beta_tester", name: "测试先锋", description: "参与平台内测", icon: "flask", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "anniversary", name: "周年纪念", description: "平台一周年纪念徽章", icon: "cake", kind: "single", seriesKey: "rare", condition: () => false },
];

export const BADGES: Badge[] = [...TIERED_BADGES, ...SINGLE_BADGES, ...RARE_BADGES];

/** 用于 UI 分组：阶梯系列 key 的显示顺序与分组标题 */
export const SERIES_ORDER: { key: string; label: string }[] = [
    ...TIERED_SERIES.map((s) => ({ key: s.seriesKey, label: s.label })),
    { key: "first_steps", label: "首步成就" },
    { key: "minesweeper", label: "扫雷游乐场" },
    { key: "rare", label: "稀有限定" },

];

/**
 * 选取用于头像/列表等处展示的徽章：每个阶梯系列只取已解锁的最高档一枚，再补足首步/稀有限定，最多返回 maxCount 枚。
 */
export function getBadgesForDisplay(badges: Badge[], unlockedIds: Set<string>, maxCount: number): Badge[] {
    const result: Badge[] = [];
    const tieredSeriesKeys = TIERED_SERIES.map((s) => s.seriesKey);
    for (const seriesKey of tieredSeriesKeys) {
        const inSeries = badges.filter((b) => b.seriesKey === seriesKey && b.tier && unlockedIds.has(b.id));
        if (inSeries.length === 0) continue;
        const highest = inSeries.reduce((a, b) => (TIER_RANK[(b.tier as BadgeTier)] > TIER_RANK[(a.tier as BadgeTier)] ? b : a));
        result.push(highest);
    }
    const singleUnlocked = badges.filter((b) => (b.seriesKey === "first_steps" || b.seriesKey === "minesweeper" || b.seriesKey === "rare") && unlockedIds.has(b.id));
    for (const b of singleUnlocked) {
        if (result.length >= maxCount) break;
        result.push(b);
    }
    return result.slice(0, maxCount);
}
