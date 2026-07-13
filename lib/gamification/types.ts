export interface UserStats {
    projectsPublished: number;
    projectsLiked: number;
    projectsCompleted: number;
    commentsCount: number;
    // 扩展的统计维度
    scienceCompleted: number;      // 完成的科学类项目
    techCompleted: number;         // 完成的技术类项目
    engineeringCompleted: number;  // 完成的工程类项目
    artCompleted: number;          // 完成的艺术类项目
    mathCompleted: number;         // 完成的数学类项目
    likesGiven: number;            // 给出的点赞数
    likesReceived: number;         // 收到的点赞数
    collectionsCount: number;     // 收藏数
    challengesJoined: number;     // 参与的挑战数
    level: number;                 // 当前等级
    loginDays: number;             // 登录天数
    consecutiveDays: number;      // 连续登录天数
    discussionsCreated: number;   // 发起的讨论数
    repliesCount: number;         // 回复数
    // 游乐场专属（从 playground_stats 云端战绩补发；游戏内仍可前端即时提示）
    minesweeperWins: number;       // 任意难度通关次数
    minesweeperExpertWins: number; // 高级难度通关次数
    minesweeperBestTime: number;   // 历史最快时间（秒），999 = 无记录
    // 五子棋专属
    gomokuWins?: number;           // 对局胜利场次
    gomokuPvEWins?: number;        // 对战 AI 获胜次数
    // 2048 专属
    game2048BestScore?: number;    // 历史最高分
    game2048MaxTile?: number;      // 达到过的最大方块
    game2048Wins?: number;         // 达到 2048+ 的次数
    // 24 点专属
    game24Solved?: number;         // 累计解出题数
    game24BestStreak?: number;     // 最长连胜
    game24BestTime?: number | null; // 最快解题时间（秒）
    // 生命游戏专属
    gameOfLifeSessions?: number;   // 运行次数
    gameOfLifeMaxGen?: number;     // 最高演化代数
    gameOfLifeChallengesSolved?: number; // 生命游戏挑战完成数
    // 汉诺塔专属
    hanoiWins?: number;            // 通关次数
    hanoiPerfect?: number;         // 以最优步数（2^n-1）通关次数
    hanoiMaxDisksCleared?: number; // 曾通关的最大圆盘层数
    // 数独专属
    sudokuWins?: number;           // 通关次数
    sudokuHardWins?: number;       // 困难难度通关次数
    // N 皇后专属
    nqueensManualSolves?: number;  // 手动求解次数
    // 排序可视化专属
    sortingRuns?: number;          // 运行排序演示次数
    sortingAlgorithmsUsed?: number; // 使用过的排序算法数量
    // 游乐场新增玩法
    fifteenWins?: number;
    memoryWins?: number;
    quickMathBestScore?: number;
    quickMathBestStreak?: number;
    mazeWins?: number;
    tangramSolved?: number;
    nonogramSolved?: number;
    ballSortSolved?: number;
    balanceSolved?: number;
    symmetrySolved?: number;
    circuitSolved?: number;
    /** 游乐场：玩过不同游戏数量（仅云端 sync 聚合） */
    playgroundGamesPlayed?: number;
    /** 游乐场：累计胜利/通关次数（仅云端 sync 聚合） */
    playgroundWinsTotal?: number;
    // 鸟类观察专属
    observationsSubmitted?: number;    // 提交的观察记录数
    speciesObserved?: number;          // 观察到的不重复物种数
    observationStreak?: number;        // 连续观察天数
    /** 新手引导毕业哨兵（xp_logs profile_growth_task_graduation v1） */
    growthTasksGraduated?: boolean;
}

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export type BadgeKind = "tiered" | "single";

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    condition: (stats: UserStats) => boolean;
    /** 仅阶梯徽章：铜/银/金/白金 */
    tier?: BadgeTier;
    /** 系列标识，用于分组展示 */
    seriesKey?: string;
    /** tiered = 四档阶梯，single = 单档/手动授予 */
    kind?: BadgeKind;
}
