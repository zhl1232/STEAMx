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
        tierNames: ["随手点赞", "慷慨之手", "赞赏引力", "赛博伯乐"],
        descriptionTemplate: (_, v) => `累计点赞 ${v} 次`,
    },
    {
        seriesKey: "intro_publish",
        label: "发布",
        icon: "upload",
        getValue: (s) => s.projectsPublished,
        thresholds: [1, 5, 10, 50],
        tierNames: ["灵感破土", "常态建造", "高产极客", "首席造物主"],
        descriptionTemplate: (_, v) => `累计发布 ${v} 个项目`,
    },
    {
        seriesKey: "intro_collections",
        label: "收藏",
        icon: "bookmark",
        getValue: (s) => s.collectionsCount,
        thresholds: [1, 50, 200, 1000],
        tierNames: ["灵感留痕", "灵感收藏家", "宝藏打捞员", "赛博图书馆"],
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
        tierNames: ["数字原住民", "代码重构员", "算法极客", "数字造物主"],
        descriptionTemplate: (_, v) => `完成技术类项目 ${v} 个`,
    },
    {
        seriesKey: "engineering_expert",
        label: "工程：结构与创造",
        icon: "blueprint",
        getValue: (s) => s.engineeringCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["图纸初探", "蓝图构建师", "重力挑战者", "传奇造物师"],
        descriptionTemplate: (_, v) => `完成工程类项目 ${v} 个`,
    },
    {
        seriesKey: "art_expert",
        label: "艺术：视觉与表达",
        icon: "palette",
        getValue: (s) => s.artCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["灵感捕捉者", "色彩原力", "视觉主宰", "美学降维者"],
        descriptionTemplate: (_, v) => `完成艺术类项目 ${v} 个`,
    },
    {
        seriesKey: "math_expert",
        label: "数学：逻辑与模型",
        icon: "calculator",
        getValue: (s) => s.mathCompleted,
        thresholds: [3, 10, 20, 50],
        tierNames: ["坐标系漫步", "逻辑矩阵", "高维解密者", "万物皆方程"],
        descriptionTemplate: (_, v) => `完成数学类项目 ${v} 个`,
    },
    {
        seriesKey: "social",
        label: "社交达人",
        icon: "message_circle",
        getValue: (s) => s.commentsCount + s.repliesCount,
        thresholds: [1, 30, 150, 500],
        tierNames: ["初次见面", "常来聊聊", "气氛担当", "评论区统治者"],
        descriptionTemplate: (_, v) => `评论与回复合计 ${v} 条`,
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
        tierNames: ["起步探索", "宝藏猎人", "传奇英雄", "传奇创造"],
        descriptionTemplate: (_, v) => `完成项目 ${v} 个`,
    },
    {
        seriesKey: "level",
        label: "等级晋升",
        icon: "award",
        getValue: (s) => s.level,
        thresholds: [5, 20, 50, 100],
        tierNames: ["新手光环", "进阶探索者", "高阶玩家", "破壁者"],
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
        thresholds: [3, 7, 30, 90],
        tierNames: ["三日之约", "一周习惯", "月度坚守", "四季恒心"],
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
        tierNames: ["物种初识", "多样发现者", "名录收集者", "万物观察者"],
        descriptionTemplate: (_, v) => `观察到 ${v} 种不同物种`,
    },
];

const TIERED_BADGES: Badge[] = TIERED_SERIES.flatMap(buildTieredBadges);

const SINGLE_BADGES: Badge[] = [
    { id: "first_step", name: "第一步", description: "完成注册账号", icon: "footprints", kind: "single", seriesKey: "first_steps", condition: () => true },
    { id: "explorer", name: "初级探索者", description: "完成 1 个项目", icon: "compass", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.projectsCompleted >= 1 },
    { id: "social_butterfly", name: "社交蝴蝶", description: "首次参与讨论", icon: "butterfly", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.commentsCount >= 1 || stats.discussionsCreated >= 1 || stats.repliesCount >= 1 },
    { id: "challenge_rookie", name: "挑战新人", description: "首次参加挑战", icon: "flag_checkered", kind: "single", seriesKey: "first_steps", condition: (stats) => stats.challengesJoined >= 1 },
    {
        id: "growth_graduate",
        name: "探索启程",
        description: "完成全部 5 项成长任务",
        icon: "rocket",
        kind: "single",
        seriesKey: "first_steps",
        condition: (stats) => stats.growthTasksGraduated === true,
    },
    // 扫雷专属徽章
    { id: "minesweeper_rookie", name: "排雷新兵", description: "首次通关扫雷（任意难度）", icon: "bomb", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperWins >= 1 },
    { id: "minesweeper_expert", name: "排雷专家", description: "完成高级难度扫雷通关", icon: "shield_star", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperExpertWins >= 1 },
    { id: "minesweeper_speedster", name: "极速拆弹", description: "在 60 秒内通关扫雷（任意难度）", icon: "timer", kind: "single", seriesKey: "minesweeper", condition: (stats) => stats.minesweeperBestTime > 0 && stats.minesweeperBestTime <= 60 },
    // 五子棋专属徽章
    { id: "gomoku_rookie", name: "开局先锋", description: "首次赢下一局五子棋", icon: "grid_nine", kind: "single", seriesKey: "gomoku", condition: (stats) => (stats.gomokuWins ?? 0) >= 1 },
    { id: "gomoku_strategist", name: "博弈策士", description: "在对战 AI 模式中取得胜利", icon: "strategy", kind: "single", seriesKey: "gomoku", condition: (stats) => (stats.gomokuPvEWins ?? 0) >= 1 },
    { id: "gomoku_master", name: "连珠大师", description: "累计赢下 10 局五子棋", icon: "trophy", kind: "single", seriesKey: "gomoku", condition: (stats) => (stats.gomokuWins ?? 0) >= 10 },
    // 2048 专属徽章
    { id: "game2048_first_win", name: "2048 达成", description: "首次合成 2048 方块", icon: "number_square_two", kind: "single", seriesKey: "game2048", condition: (stats) => (stats.game2048Wins ?? 0) >= 1 },
    { id: "game2048_4096", name: "超越极限", description: "合成 4096 方块", icon: "cube", kind: "single", seriesKey: "game2048", condition: (stats) => (stats.game2048MaxTile ?? 0) >= 4096 },
    { id: "game2048_8192", name: "数字传说", description: "合成 8192 方块", icon: "crown", kind: "single", seriesKey: "game2048", condition: (stats) => (stats.game2048MaxTile ?? 0) >= 8192 },
    { id: "game2048_high_scorer", name: "分数霸主", description: "单局得分超过 20000", icon: "trophy", kind: "single", seriesKey: "game2048", condition: (stats) => (stats.game2048BestScore ?? 0) >= 20000 },
    // 24 点专属徽章
    { id: "game24_first_solve", name: "心算入门", description: "首次算出 24 点", icon: "calculator", kind: "single", seriesKey: "game24", condition: (stats) => (stats.game24Solved ?? 0) >= 1 },
    { id: "game24_streak_5", name: "连胜达人", description: "24 点连续解出 5 题", icon: "flame", kind: "single", seriesKey: "game24", condition: (stats) => (stats.game24BestStreak ?? 0) >= 5 },
    { id: "game24_streak_10", name: "心算大师", description: "24 点连续解出 10 题", icon: "brain", kind: "single", seriesKey: "game24", condition: (stats) => (stats.game24BestStreak ?? 0) >= 10 },
    { id: "game24_speed", name: "闪电速算", description: "在 10 秒内解出 24 点", icon: "zap", kind: "single", seriesKey: "game24", condition: (stats) => (stats.game24BestTime ?? 999) <= 10 },
    { id: "game24_50", name: "数学达人", description: "累计解出 50 题 24 点", icon: "award", kind: "single", seriesKey: "game24", condition: (stats) => (stats.game24Solved ?? 0) >= 50 },
    // 生命游戏专属徽章
    { id: "life_explorer", name: "涌现探索者", description: "首次运行生命游戏", icon: "dna", kind: "single", seriesKey: "life", condition: (stats) => (stats.gameOfLifeSessions ?? 0) >= 1 },
    { id: "life_observer", name: "永恒观测者", description: "生命游戏演化超过 1000 代", icon: "tree_structure", kind: "single", seriesKey: "life", condition: (stats) => (stats.gameOfLifeMaxGen ?? 0) >= 1000 },
    { id: "life_challenge_first", name: "生命设计师", description: "完成 1 个生命游戏挑战", icon: "target", kind: "single", seriesKey: "life", condition: (stats) => (stats.gameOfLifeChallengesSolved ?? 0) >= 1 },
    { id: "life_challenge_all", name: "涌现工程师", description: "完成所有生命游戏挑战", icon: "sparkles", kind: "single", seriesKey: "life", condition: (stats) => (stats.gameOfLifeChallengesSolved ?? 0) >= 8 },
    // 汉诺塔专属徽章
    { id: "hanoi_first_win", name: "塔之初见", description: "首次通关汉诺塔", icon: "layers", kind: "single", seriesKey: "hanoi", condition: (stats) => (stats.hanoiWins ?? 0) >= 1 },
    { id: "hanoi_perfect", name: "最优解", description: "以最少步数（2ⁿ−1）通关汉诺塔", icon: "target", kind: "single", seriesKey: "hanoi", condition: (stats) => (stats.hanoiPerfect ?? 0) >= 1 },
    { id: "hanoi_master", name: "递归大师", description: "通关 8 层汉诺塔", icon: "tree_structure", kind: "single", seriesKey: "hanoi", condition: (stats) => (stats.hanoiWins ?? 0) >= 5 },
    // 数独专属徽章
    { id: "sudoku_first_win", name: "数独入门", description: "首次通关数独", icon: "hash", kind: "single", seriesKey: "sudoku", condition: (stats) => (stats.sudokuWins ?? 0) >= 1 },
    { id: "sudoku_hard", name: "数独高手", description: "通关困难难度数独", icon: "target", kind: "single", seriesKey: "sudoku", condition: (stats) => (stats.sudokuHardWins ?? 0) >= 1 },
    { id: "sudoku_master", name: "约束大师", description: "累计通关 10 次数独", icon: "puzzle_piece", kind: "single", seriesKey: "sudoku", condition: (stats) => (stats.sudokuWins ?? 0) >= 10 },
    // N 皇后专属徽章
    { id: "nqueens_first_solve", name: "皇后之手", description: "首次手动解出 N 皇后", icon: "crown", kind: "single", seriesKey: "nqueens", condition: (stats) => (stats.nqueensManualSolves ?? 0) >= 1 },
    { id: "nqueens_master", name: "回溯专家", description: "累计手动解出 5 次 N 皇后", icon: "strategy", kind: "single", seriesKey: "nqueens", condition: (stats) => (stats.nqueensManualSolves ?? 0) >= 5 },
    // 电路拼图专属徽章
    { id: "circuit_first_solve", name: "电路入门", description: "首次点亮灯泡", icon: "lightbulb_filament", kind: "single", seriesKey: "circuit", condition: (stats) => (stats.circuitSolved ?? 0) >= 1 },
    { id: "circuit_10", name: "电工达人", description: "累计完成 10 个电路关卡", icon: "circuitry", kind: "single", seriesKey: "circuit", condition: (stats) => (stats.circuitSolved ?? 0) >= 10 },
    { id: "circuit_logic", name: "逻辑门大师", description: "完成所有含逻辑门的关卡", icon: "binary", kind: "single", seriesKey: "circuit", condition: (stats) => stats.circuitLogicCleared === true },
    // 游乐场新增玩法徽章
    { id: "fifteen_first", name: "滑块入门", description: "首次复原数字华容道", icon: "grid_nine", kind: "single", seriesKey: "fifteen", condition: (stats) => (stats.fifteenWins ?? 0) >= 1 },
    { id: "fifteen_master", name: "空间规划师", description: "累计复原 5 次数字华容道", icon: "puzzle_piece", kind: "single", seriesKey: "fifteen", condition: (stats) => (stats.fifteenWins ?? 0) >= 5 },
    { id: "memory_first", name: "记忆点亮", description: "首次完成记忆翻牌", icon: "brain", kind: "single", seriesKey: "memory", condition: (stats) => (stats.memoryWins ?? 0) >= 1 },
    { id: "memory_master", name: "工作记忆达人", description: "累计完成 5 次记忆翻牌", icon: "award", kind: "single", seriesKey: "memory", condition: (stats) => (stats.memoryWins ?? 0) >= 5 },
    { id: "quick_math_first", name: "速算起跑", description: "速算闪电战得分达到 100", icon: "calculator", kind: "single", seriesKey: "quickmath", condition: (stats) => (stats.quickMathBestScore ?? 0) >= 100 },
    { id: "quick_math_combo", name: "连击心算家", description: "速算闪电战达到 10 连击", icon: "zap", kind: "single", seriesKey: "quickmath", condition: (stats) => (stats.quickMathBestStreak ?? 0) >= 10 },
    { id: "maze_first", name: "迷宫初探", description: "首次走出迷宫", icon: "compass", kind: "single", seriesKey: "maze", condition: (stats) => (stats.mazeWins ?? 0) >= 1 },
    { id: "maze_master", name: "寻路专家", description: "累计走出 5 次迷宫", icon: "route", kind: "single", seriesKey: "maze", condition: (stats) => (stats.mazeWins ?? 0) >= 5 },
    { id: "tangram_first", name: "几何拼手", description: "完成 1 个七巧板剪影", icon: "palette", kind: "single", seriesKey: "tangram", condition: (stats) => (stats.tangramSolved ?? 0) >= 1 },
    { id: "tangram_all", name: "七巧大师", description: "完成所有七巧板剪影", icon: "sparkles", kind: "single", seriesKey: "tangram", condition: (stats) => (stats.tangramSolved ?? 0) >= 8 },
    // 鸟类观察专属徽章
    { id: "first_observation", name: "第一次观察", description: "提交第一条鸟类观察记录", icon: "bird", kind: "single", seriesKey: "bird_observation", condition: (stats) => (stats.observationsSubmitted ?? 0) >= 1 },
    { id: "observation_streak_7", name: "连续观察 7 天", description: "连续 7 天提交观察记录", icon: "flame", kind: "single", seriesKey: "bird_observation", condition: (stats) => (stats.observationStreak ?? 0) >= 7 },
];

const RARE_BADGES: Badge[] = [
    { id: "early_bird", name: "平台先驱", description: "前 100 名注册用户", icon: "rocket", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "bug_hunter", name: "漏洞猎人", description: "发现并报告平台 Bug", icon: "bug", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "contributor", name: "贡献者", description: "为平台做出特殊贡献", icon: "hand_heart", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "beta_tester", name: "测试先锋", description: "参与平台内测", icon: "flask", kind: "single", seriesKey: "rare", condition: () => false },
    { id: "anniversary", name: "周年纪念", description: "平台一周年纪念徽章", icon: "cake", kind: "single", seriesKey: "rare", condition: () => false },
];

export const BADGES: Badge[] = [...TIERED_BADGES, ...SINGLE_BADGES, ...RARE_BADGES];

/** 用于 UI 分组：阶梯系列 key 的显示顺序与分组标题 */
export const SERIES_ORDER: { key: string; label: string }[] = [
    ...TIERED_SERIES.map((s) => ({ key: s.seriesKey, label: s.label })),
    { key: "first_steps", label: "首步成就" },
    { key: "minesweeper", label: "扫雷游乐场" },
    { key: "gomoku", label: "五子棋战局" },
    { key: "game2048", label: "2048 挑战" },
    { key: "game24", label: "24 点速算" },
    { key: "life", label: "生命游戏" },
    { key: "hanoi", label: "汉诺塔" },
    { key: "sudoku", label: "数独" },
    { key: "nqueens", label: "N 皇后" },
    { key: "circuit", label: "电路拼图" },
    { key: "fifteen", label: "数字华容道" },
    { key: "memory", label: "记忆翻牌" },
    { key: "quickmath", label: "速算闪电战" },
    { key: "maze", label: "迷宫探险" },
    { key: "tangram", label: "七巧板" },
    { key: "bird_observation", label: "鸟类观察" },
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
    const singleSeries = new Set(["first_steps", "minesweeper", "gomoku", "game2048", "game24", "life", "hanoi", "sudoku", "nqueens", "circuit", "fifteen", "memory", "quickmath", "maze", "tangram", "bird_observation", "rare"]);
    const singleUnlocked = badges.filter((b) => b.seriesKey && singleSeries.has(b.seriesKey) && unlockedIds.has(b.id));
    for (const b of singleUnlocked) {
        if (result.length >= maxCount) break;
        result.push(b);
    }
    return result.slice(0, maxCount);
}
