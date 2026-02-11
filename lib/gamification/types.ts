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
    challengesJoined: number;     // 参与的挑战赛数
    level: number;                 // 当前等级
    loginDays: number;             // 登录天数
    consecutiveDays: number;      // 连续登录天数
    discussionsCreated: number;   // 发起的讨论数
    repliesCount: number;         // 回复数
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
