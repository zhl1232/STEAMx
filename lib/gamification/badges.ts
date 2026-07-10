import { Badge, BadgeTier, UserStats } from "./types";

const TIER_RANK: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

export const BADGE_TIERS: BadgeTier[] = ["bronze", "silver", "gold", "platinum"];

/** 阶梯徽章档位标签（UI 角标，不拼进成就名） */
export const BADGE_TIER_LABELS: Record<BadgeTier, string> = {
    bronze: "铜",
    silver: "银",
    gold: "金",
    platinum: "白金",
};

type TierThresholds = [number, number, number, number]; // [铜, 银, 金, 白金]
type TierNames = [string, string, string, string];

interface TieredSeriesConfig {
    seriesKey: string;
    getValue: (stats: UserStats) => number;
    thresholds: TierThresholds;
    tierNames: TierNames;
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
            name: config.tierNames[i],
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
        tierNames: ["随手点赞", "慷慨之手", "热心鼓励官", "慧眼识珠"],
        descriptionTemplate: (_, v) => `累计点赞 ${v} 次`,
    },
    {
        seriesKey: "intro_publish",
        label: "发布",
        icon: "upload",
        getValue: (s) => s.projectsPublished,
        thresholds: [1, 5, 10, 50],
        tierNames: ["灵感破土", "稳定创作", "高产创作者", "灵感主理人"],
        descriptionTemplate: (_, v) => `累计发布 ${v} 个项目`,
    },
    {
        seriesKey: "intro_collections",
        label: "收藏",
        icon: "bookmark",
        getValue: (s) => s.collectionsCount,
        thresholds: [1, 50, 200, 1000],
        tierNames: ["灵感留痕", "灵感收藏家", "宝藏打捞员", "典藏策展人"],
        descriptionTemplate: (_, v) => `累计收藏 ${v} 个项目`,
    },
    {
        seriesKey: "science_expert",
        label: "科学：观察与实验",
        icon: "atom",
        getValue: (s) => s.scienceCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["好奇观察员", "实验室常客", "假说验证者", "真理追寻者"],
        descriptionTemplate: (_, v) => `完成科学类项目 ${v} 个`,
    },
    {
        seriesKey: "tech_expert",
        label: "技术：代码与数字",
        icon: "code_2",
        getValue: (s) => s.techCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["逻辑启程", "模块搭建师", "算法能手", "数字建筑师"],
        descriptionTemplate: (_, v) => `完成技术类项目 ${v} 个`,
    },
    {
        seriesKey: "engineering_expert",
        label: "工程：结构与创造",
        icon: "blueprint",
        getValue: (s) => s.engineeringCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["图纸初探", "蓝图构建师", "结构驾驭者", "匠心工程师"],
        descriptionTemplate: (_, v) => `完成工程类项目 ${v} 个`,
    },
    {
        seriesKey: "art_expert",
        label: "艺术：视觉与表达",
        icon: "palette",
        getValue: (s) => s.artCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["灵感捕捉者", "色感觉醒", "构图掌舵人", "意境塑造者"],
        descriptionTemplate: (_, v) => `完成艺术类项目 ${v} 个`,
    },
    {
        seriesKey: "math_expert",
        label: "数学：逻辑与模型",
        icon: "calculator",
        getValue: (s) => s.mathCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["坐标系漫步", "逻辑矩阵", "模型破译者", "万物皆方程"],
        descriptionTemplate: (_, v) => `完成数学类项目 ${v} 个`,
    },
    {
        seriesKey: "social",
        label: "讨论参与",
        icon: "message_circle",
        getValue: (s) => s.commentsCount + s.repliesCount + s.discussionsCreated,
        thresholds: [1, 30, 150, 500],
        tierNames: ["初次见面", "常来聊聊", "气氛担当", "讨论引路人"],
        descriptionTemplate: (_, v) => `发帖、评论与回复合计 ${v} 条`,
    },
    {
        seriesKey: "popularity",
        label: "人气之星",
        icon: "heart",
        getValue: (s) => s.likesReceived,
        thresholds: [10, 100, 500, 2000],
        tierNames: ["小有名气", "备受关注", "万众瞩目", "社区灯塔"],
        descriptionTemplate: (_, v) => `收到赞 ${v} 个`,
    },
    {
        seriesKey: "milestone",
        label: "项目完成",
        icon: "trophy",
        getValue: (s) => s.projectsCompleted,
        thresholds: [5, 20, 50, 100],
        tierNames: ["起步探索", "探索进阶者", "创造巨匠", "传奇英雄"],
        descriptionTemplate: (_, v) => `完成项目 ${v} 个`,
    },
    {
        seriesKey: "level",
        label: "等级晋升",
        icon: "award",
        getValue: (s) => s.level,
        thresholds: [5, 20, 50, 100],
        tierNames: ["新手光环", "进阶探索者", "高阶探索者", "破壁者"],
        descriptionTemplate: (_, v) => `达到等级 ${v}`,
    },
    {
        seriesKey: "challenge",
        label: "挑战",
        icon: "target",
        getValue: (s) => s.challengesJoined,
        thresholds: [2, 6, 15, 30],
        tierNames: ["挑战尝鲜", "赛场常客", "挑战达人", "征途传奇"],
        descriptionTemplate: (_, v) => `参加挑战 ${v} 次`,
    },
    {
        seriesKey: "streak",
        label: "连续打卡",
        icon: "flame",
        getValue: (s) => s.consecutiveDays,
        thresholds: [3, 7, 30, 100],
        tierNames: ["三日之约", "一周习惯", "月度坚守", "百日恒心"],
        descriptionTemplate: (_, v) => `连续登录 ${v} 天`,
    },
    {
        seriesKey: "bird_observer",
        label: "观察家",
        icon: "binoculars",
        getValue: (s) => s.observationsSubmitted ?? 0,
        thresholds: [1, 10, 30, 100],
        tierNames: ["见习观察员", "田野记录者", "自然追迹者", "自然编目者"],
        descriptionTemplate: (_, v) => `提交 ${v} 条观察记录`,
    },
    {
        seriesKey: "species_collector",
        label: "物种收集",
        icon: "feather",
        getValue: (s) => s.speciesObserved ?? 0,
        thresholds: [3, 10, 30, 80],
        tierNames: ["物种初识", "多样发现者", "名录收集者", "物种博学家"],
        descriptionTemplate: (_, v) => `观察到 ${v} 种不同物种`,
    },
    {
        seriesKey: "playground_explorer",
        label: "游乐场探索",
        icon: "compass",
        getValue: (s) => s.playgroundGamesPlayed ?? 0,
        thresholds: [3, 6, 10, 13],
        tierNames: ["游园新客", "多面玩家", "全能体验官", "全图鉴玩家"],
        descriptionTemplate: (_, v) => `玩过 ${v} 个不同游乐场游戏`,
    },
    {
        seriesKey: "playground_victories",
        label: "游乐场战绩",
        icon: "trophy",
        getValue: (s) => s.playgroundWinsTotal ?? 0,
        thresholds: [5, 30, 150, 500],
        tierNames: ["首胜达成", "连战连捷", "百战老手", "游乐场传奇"],
        descriptionTemplate: (_, v) => `累计胜利/通关 ${v} 次`,
    },
];

const TIERED_BADGES: Badge[] = TIERED_SERIES.flatMap(buildTieredBadges);

const SINGLE_BADGES: Badge[] = [
    { id: "first_step", name: "第一步", description: "完成注册账号", icon: "footprints", kind: "single", seriesKey: "first_steps", condition: () => true },
    { id: "explorer", name: "初级探索者", description: "完成 1 个项目", icon: "compass", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.projectsCompleted >= 1 },
    { id: "challenge_rookie", name: "挑战新人", description: "首次参加挑战", icon: "flag_checkered", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.challengesJoined >= 1 },
    {
        id: "growth_graduate",
        name: "新手毕业",
        description: "完成全部 5 项新手引导",
        icon: "rocket",
        kind: "single",
        seriesKey: "first_steps",
        condition: (stats) => stats.growthTasksGraduated === true,
    },
    // 游乐场高难度彩蛋（跨游戏阶梯见 playground_explorer / playground_victories）
    { id: "minesweeper_speedster", name: "极速拆弹", description: "在 60 秒内通关扫雷（任意难度）", icon: "timer", kind: "single", seriesKey: "playground_star", condition: (stats) => stats.minesweeperBestTime > 0 && stats.minesweeperBestTime <= 60 },
    { id: "game2048_8192", name: "数字传说", description: "合成 8192 方块", icon: "crown", kind: "single", seriesKey: "playground_star", condition: (stats) => (stats.game2048MaxTile ?? 0) >= 8192 },
    { id: "game24_speed", name: "闪电速算", description: "在 10 秒内解出 24 点", icon: "zap", kind: "single", seriesKey: "playground_star", condition: (stats) => (stats.game24BestTime ?? 999) <= 10 },
    { id: "hanoi_perfect", name: "巴别塔最优解", description: "以最少步数（2ⁿ−1）通关汉诺塔", icon: "target", kind: "single", seriesKey: "playground_star", condition: (stats) => (stats.hanoiPerfect ?? 0) >= 1 },
    { id: "life_challenge_all", name: "涌现工程师", description: "完成所有生命游戏挑战", icon: "sparkles", kind: "single", seriesKey: "playground_star", condition: (stats) => (stats.gameOfLifeChallengesSolved ?? 0) >= 8 },
    { id: "tangram_all", name: "七巧大师", description: "完成全部 4 个七巧板剪影", icon: "sparkles", kind: "single", seriesKey: "playground_star", condition: (stats) => (stats.tangramSolved ?? 0) >= 4 },
];

/**
 * 内测期间对所有登录用户自动发放「测试先锋」。
 * 结束后改为 false：新用户不再获得，已获得者保留。
 */
export const GRANT_BETA_TESTER_BADGE = true;

const RARE_BADGES: Badge[] = [
    { id: "early_bird", name: "平台先驱", description: "前 100 名注册用户", icon: "rocket", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "bug_hunter", name: "漏洞猎人", description: "发现并报告平台 Bug", icon: "bug", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "contributor", name: "贡献者", description: "为平台做出特殊贡献", icon: "hand_heart", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "beta_tester", name: "测试先锋", description: "参与平台内测", icon: "flask", kind: "single", seriesKey: "rare", condition: () => GRANT_BETA_TESTER_BADGE },
    { id: "anniversary", name: "周年纪念", description: "平台一周年纪念徽章", icon: "cake", kind: "single", seriesKey: "rare", condition: () => false },
];

export const BADGES: Badge[] = [...TIERED_BADGES, ...SINGLE_BADGES, ...RARE_BADGES];

export const PLAYGROUND_BADGE_SERIES_KEYS = ["playground_explorer", "playground_victories", "playground_star"] as const;
export const PLAYGROUND_BADGE_COUNT =
    TIERED_BADGES.filter((badge) => badge.seriesKey === "playground_explorer" || badge.seriesKey === "playground_victories").length +
    SINGLE_BADGES.filter((badge) => badge.seriesKey === "playground_star").length;

/** 用于 UI 分组：阶梯系列 key 的显示顺序与分组标题 */
export const SERIES_ORDER: { key: string; label: string }[] = [
    ...TIERED_SERIES.map((s) => ({ key: s.seriesKey, label: s.label })),
    { key: "first_steps", label: "首步成就" },
    { key: "playground_star", label: "游乐场彩蛋" },
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
    const singleSeries = new Set(["first_steps", "playground_star", "rare"]);
    const singleUnlocked = badges.filter((b) => b.seriesKey && singleSeries.has(b.seriesKey) && unlockedIds.has(b.id));
    for (const b of singleUnlocked) {
        if (result.length >= maxCount) break;
        result.push(b);
    }
    return result.slice(0, maxCount);
}
