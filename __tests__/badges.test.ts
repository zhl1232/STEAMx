import { describe, expect, test } from 'vitest'
import {
    BADGES,
    PLAYGROUND_BADGE_COUNT,
    getBadgeDisplayDefinitions,
    getNextSeriesThreshold,
    getSeriesDisplayBadge,
    getVisibleSeriesBadges,
    isSeriesAtVisibleMax,
} from '../lib/gamification/badges'
import { UserStats } from '../lib/gamification/types'

const createStats = (overrides: Partial<UserStats> = {}): UserStats => ({
    projectsPublished: 0,
    projectsLiked: 0,
    projectsCompleted: 0,
    commentsCount: 0,
    scienceCompleted: 0,
    techCompleted: 0,
    engineeringCompleted: 0,
    artCompleted: 0,
    mathCompleted: 0,
    likesGiven: 0,
    likesReceived: 0,
    collectionsCount: 0,
    challengesJoined: 0,
    level: 1,
    loginDays: 1,
    consecutiveDays: 1,
    discussionsCreated: 0,
    repliesCount: 0,
    minesweeperWins: 0,
    minesweeperExpertWins: 0,
    minesweeperBestTime: 999,
    ...overrides,
});

describe("Minesweeper Badge Logic", () => {
    test("minesweeper_speedster requires bestTime > 0 and <= 60", () => {
        const badge = BADGES.find((b) => b.id === "minesweeper_speedster");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ minesweeperBestTime: 999 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperBestTime: 61 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperBestTime: 60 }))).toBe(true);
        expect(badge!.condition(createStats({ minesweeperBestTime: 30 }))).toBe(true);
    });
});

describe("Growth graduate badge", () => {
    test("growth_graduate requires growthTasksGraduated flag", () => {
        const badge = BADGES.find((b) => b.id === "growth_graduate");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ growthTasksGraduated: false }))).toBe(false);
        expect(badge!.condition(createStats({ growthTasksGraduated: undefined }))).toBe(false);
        expect(badge!.condition(createStats({ growthTasksGraduated: true }))).toBe(true);
    });
});

describe("Badge System Logic (Dynamic Badges)", () => {
    test("first_step badge should always be true", () => {
        const badge = BADGES.find((b) => b.id === "first_step");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(true);
    });

    test("explorer badge requires 1 project or 1 lesson", () => {
        const badge = BADGES.find((b) => b.id === "explorer");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ projectsCompleted: 0, lessonsCompleted: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ projectsCompleted: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ projectsCompleted: 0, lessonsCompleted: 1 }))).toBe(true);
    });

    // intro_likes 系列覆盖原 first_like 逻辑
    test("intro_likes_bronze requires likesGiven >= 1", () => {
        const badge = BADGES.find((b) => b.id === "intro_likes_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ likesGiven: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ likesGiven: 1 }))).toBe(true);
    });

    test("intro_likes_silver requires likesGiven >= 50", () => {
        const badge = BADGES.find((b) => b.id === "intro_likes_silver");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ likesGiven: 49 }))).toBe(false);
        expect(badge!.condition(createStats({ likesGiven: 50 }))).toBe(true);
    });

    // intro_comments 系列已删除，由 social 系列覆盖
    test("intro_comments series badges should not exist", () => {
        const ids = ["intro_comments_bronze", "intro_comments_silver", "intro_comments_gold", "intro_comments_platinum"];
        for (const id of ids) {
            expect(BADGES.find((b) => b.id === id)).toBeUndefined();
        }
    });

    // social 系列铜牌现在从 1 开始（覆盖首次评论）
    test("social_bronze requires commentsCount + repliesCount >= 1", () => {
        const badge = BADGES.find((b) => b.id === "social_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ repliesCount: 1 }))).toBe(true);
    });

    test("social_silver requires commentsCount + repliesCount >= 30", () => {
        const badge = BADGES.find((b) => b.id === "social_silver");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ commentsCount: 29 }))).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 30 }))).toBe(true);
    });

    // intro_publish 白金阈值已从 30 调整为 50（合并 creator 系列）
    test("intro_publish_platinum requires projectsPublished >= 50", () => {
        const badge = BADGES.find((b) => b.id === "intro_publish_platinum");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ projectsPublished: 49 }))).toBe(false);
        expect(badge!.condition(createStats({ projectsPublished: 50 }))).toBe(true);
    });

    // creator 系列已合并入 intro_publish，不应再存在
    test("creator series badges should not exist", () => {
        const creatorIds = ["creator_bronze", "creator_silver", "creator_gold", "creator_platinum"];
        for (const id of creatorIds) {
            expect(BADGES.find((b) => b.id === id)).toBeUndefined();
        }
    });

    // 已删除的重叠 single 徽章不应再存在
    test("removed duplicate single badges should not exist", () => {
        const removedIds = ["first_like", "first_comment", "first_publish", "first_collection", "first_observation", "observation_streak_7"];
        for (const id of removedIds) {
            expect(BADGES.find((b) => b.id === id)).toBeUndefined();
        }
    });

    test("science_expert_gold requires scienceCompleted >= 20", () => {
        const badge = BADGES.find((b) => b.id === "science_expert_gold");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ scienceCompleted: 19 }))).toBe(false);
        expect(badge!.condition(createStats({ scienceCompleted: 20 }))).toBe(true);
    });

    test("social_butterfly duplicate single badge should not exist", () => {
        expect(BADGES.find((b) => b.id === "social_butterfly")).toBeUndefined();
    });

    test("social_bronze counts comments and replies but not discussions", () => {
        const badge = BADGES.find((b) => b.id === "social_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ discussionsCreated: 1 }))).toBe(false);
        expect(badge!.condition(createStats({ repliesCount: 1 }))).toBe(true);
    });

    test("social_platinum requires comments + replies >= 500", () => {
        const badge = BADGES.find((b) => b.id === "social_platinum");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ discussionsCreated: 500, commentsCount: 250, repliesCount: 249 }))).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 250, repliesCount: 250 }))).toBe(true);
    });

    test("level_bronze requires level >= 5", () => {
        const badge = BADGES.find((b) => b.id === "level_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ level: 4 }))).toBe(false);
        expect(badge!.condition(createStats({ level: 5 }))).toBe(true);
    });

    test("manual rare badges have condition that always returns false", () => {
        const rareIds = ["early_bird", "bug_hunter", "contributor", "anniversary"];
        for (const id of rareIds) {
            const badge = BADGES.find((b) => b.id === id);
            expect(badge).toBeDefined();
            expect(badge!.condition(createStats({ projectsCompleted: 999, level: 100 }))).toBe(false);
        }
    });

    test("beta_tester is granted to all users during open beta", () => {
        const badge = BADGES.find((b) => b.id === "beta_tester");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(true);
    });

    test("streak_platinum requires consecutiveDays >= 100", () => {
        const badge = BADGES.find((b) => b.id === "streak_platinum");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ consecutiveDays: 99 }))).toBe(false);
        expect(badge!.condition(createStats({ consecutiveDays: 100 }))).toBe(true);
    });

    test("tiered badge names use achievement titles without legacy dot format", () => {
        const tiered = BADGES.filter((b) => b.kind === "tiered");
        expect(tiered.length).toBe(89);
        for (const badge of tiered) {
            expect(badge.name).not.toMatch(/·/);
            expect(badge.name.length).toBeGreaterThan(0);
        }
    });

    test("intro_likes_silver is named 慷慨之手", () => {
        const badge = BADGES.find((b) => b.id === "intro_likes_silver");
        expect(badge?.name).toBe("慷慨之手");
    });

    test("milestone series uses 项目完成 tier names", () => {
        expect(BADGES.find((b) => b.id === "milestone_gold")?.name).toBe("创造巨匠");
        expect(BADGES.find((b) => b.id === "milestone_platinum")?.name).toBe("传奇英雄");
        expect(BADGES.find((b) => b.id === "science_expert_bronze")?.name).toBe("好奇观察员");
        expect(BADGES.find((b) => b.id === "level_gold")?.name).toBe("高阶探索者");
    });

    test("tangram_all requires completing the current 4 silhouettes", () => {
        const badge = BADGES.find((b) => b.id === "tangram_all");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ tangramSolved: 3 }))).toBe(false);
        expect(badge!.condition(createStats({ tangramSolved: 4 }))).toBe(true);
    });

    test("function_wars_all requires completing all 10 levels", () => {
        const badge = BADGES.find((b) => b.id === "function_wars_all");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ functionWarsSolved: 9 }))).toBe(false);
        expect(badge!.condition(createStats({ functionWarsSolved: 10 }))).toBe(true);
    });

    test("function_wars_challenge_all requires completing all 5 challenge levels", () => {
        const badge = BADGES.find((b) => b.id === "function_wars_challenge_all");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ functionWarsChallengeSolved: 4 }))).toBe(false);
        expect(badge!.condition(createStats({ functionWarsChallengeSolved: 5 }))).toBe(true);
    });

    test("removed playground single badges should not exist", () => {
        const removedIds = [
            "minesweeper_rookie",
            "minesweeper_expert",
            "gomoku_rookie",
            "gomoku_strategist",
            "gomoku_master",
            "game2048_first_win",
            "game2048_4096",
            "game2048_high_scorer",
            "game24_first_solve",
            "game24_streak_5",
            "game24_streak_10",
            "game24_50",
            "life_explorer",
            "life_observer",
            "life_challenge_first",
            "hanoi_first_win",
            "hanoi_master",
            "sudoku_first_win",
            "sudoku_hard",
            "sudoku_master",
            "nqueens_first_solve",
            "nqueens_master",
            "circuit_first_solve",
            "circuit_10",
            "circuit_logic",
            "sorting_first_run",
            "sorting_polyglot",
            "fifteen_first",
            "fifteen_master",
            "memory_first",
            "memory_master",
            "quick_math_first",
            "quick_math_combo",
            "maze_first",
            "maze_master",
            "tangram_first",
        ];
        for (const id of removedIds) {
            expect(BADGES.find((b) => b.id === id)).toBeUndefined();
        }
    });

    test("playground star badges use playground_star series", () => {
        const starIds = [
            "minesweeper_speedster",
            "game2048_8192",
            "game24_speed",
            "hanoi_perfect",
            "life_challenge_all",
            "tangram_all",
            "function_wars_all",
            "function_wars_challenge_all",
        ];
        for (const id of starIds) {
            const badge = BADGES.find((b) => b.id === id);
            expect(badge).toBeDefined();
            expect(badge!.seriesKey).toBe("playground_star");
        }
    });

    test("playground_explorer tiers require games played thresholds", () => {
        const bronze = BADGES.find((b) => b.id === "playground_explorer_bronze");
        const platinum = BADGES.find((b) => b.id === "playground_explorer_platinum");
        expect(bronze!.condition(createStats({ playgroundGamesPlayed: 2 }))).toBe(false);
        expect(bronze!.condition(createStats({ playgroundGamesPlayed: 3 }))).toBe(true);
        expect(platinum!.condition(createStats({ playgroundGamesPlayed: 17 }))).toBe(false);
        expect(platinum!.condition(createStats({ playgroundGamesPlayed: 18 }))).toBe(true);
    });

    test("playground_victories tiers require total wins thresholds", () => {
        const bronze = BADGES.find((b) => b.id === "playground_victories_bronze");
        const platinum = BADGES.find((b) => b.id === "playground_victories_platinum");
        expect(bronze!.condition(createStats({ playgroundWinsTotal: 4 }))).toBe(false);
        expect(bronze!.condition(createStats({ playgroundWinsTotal: 5 }))).toBe(true);
        expect(platinum!.condition(createStats({ playgroundWinsTotal: 499 }))).toBe(false);
        expect(platinum!.condition(createStats({ playgroundWinsTotal: 500 }))).toBe(true);
    });

    test("bird and insect ladders use the planned thresholds", () => {
        expect(BADGES.find((b) => b.id === "bird_common_bronze")!.condition(createStats({ commonBirdsObserved: 2 }))).toBe(false);
        expect(BADGES.find((b) => b.id === "bird_common_bronze")!.condition(createStats({ commonBirdsObserved: 3 }))).toBe(true);
        expect(BADGES.find((b) => b.id === "bird_uncommon_gold")!.condition(createStats({ uncommonBirdsObserved: 11 }))).toBe(false);
        expect(BADGES.find((b) => b.id === "bird_rare_platinum")!.condition(createStats({ rareBirdsObserved: 8 }))).toBe(true);
        expect(BADGES.find((b) => b.id === "insect_rank_platinum")!.condition(createStats({ insectRank: 4 }))).toBe(true);
        expect(BADGES.find((b) => b.id === "insect_rank_diamond")!.condition(createStats({ insectRank: 4 }))).toBe(false);
        expect(BADGES.find((b) => b.id === "insect_rank_diamond")!.condition(createStats({ insectRank: 5 }))).toBe(true);
    });

    test("getSeriesDisplayBadge returns the highest visible tier and hides locked diamond", () => {
        const insect = BADGES.filter((badge) => badge.seriesKey === "insect_rank");
        const withoutDiamond = getSeriesDisplayBadge(
            insect,
            new Set(["insect_rank_bronze", "insect_rank_silver", "insect_rank_gold", "insect_rank_platinum"]),
        );
        expect(withoutDiamond?.id).toBe("insect_rank_platinum");
        expect(getVisibleSeriesBadges(insect, new Set(["insect_rank_platinum"])).some((badge) => badge.tier === "diamond")).toBe(false);

        const withDiamond = getSeriesDisplayBadge(insect, new Set(["insect_rank_diamond"]));
        expect(withDiamond?.id).toBe("insect_rank_diamond");
    });

    test("public badge definitions contain only serializable display fields", () => {
        const [displayBadge] = getBadgeDisplayDefinitions(BADGES.slice(0, 1));

        expect(displayBadge).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            icon: expect.any(String),
        });
        expect(displayBadge).not.toHaveProperty("condition");
        expect(() => JSON.stringify(displayBadge)).not.toThrow();
    });

    test("playground badge count follows the active playground badge series", () => {
        const count = BADGES.filter((badge) =>
            badge.seriesKey === "playground_explorer" ||
            badge.seriesKey === "playground_victories" ||
            badge.seriesKey === "playground_star"
        ).length;

        expect(PLAYGROUND_BADGE_COUNT).toBe(16);
        expect(PLAYGROUND_BADGE_COUNT).toBe(count);
    });

    test("getNextSeriesThreshold correctly skips unlocked tiers even if current stats is lower", () => {
        // 当用户已解锁铜档（intro_collections_bronze），即使 current 是 0，下一档也应是银档（50）
        const nextThreshold = getNextSeriesThreshold(
            "intro_collections",
            0,
            new Set(["intro_collections_bronze"]),
        );
        expect(nextThreshold).toBe(50);

        // 当用户已解锁全部档位，返回 null 且 isSeriesAtVisibleMax 为 true
        const allUnlocked = new Set([
            "intro_collections_bronze",
            "intro_collections_silver",
            "intro_collections_gold",
            "intro_collections_platinum",
        ]);
        expect(getNextSeriesThreshold("intro_collections", 0, allUnlocked)).toBeNull();
        expect(isSeriesAtVisibleMax("intro_collections", 0, allUnlocked)).toBe(true);
    });
});
