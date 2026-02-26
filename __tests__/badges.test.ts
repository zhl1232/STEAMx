import { BADGES } from "../lib/gamification/badges";
import { UserStats } from "../lib/gamification/types";

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
    test("minesweeper_rookie requires minesweeperWins >= 1", () => {
        const badge = BADGES.find((b) => b.id === "minesweeper_rookie");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ minesweeperWins: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperWins: 1 }))).toBe(true);
    });

    test("minesweeper_expert requires minesweeperExpertWins >= 1", () => {
        const badge = BADGES.find((b) => b.id === "minesweeper_expert");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ minesweeperExpertWins: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperExpertWins: 1 }))).toBe(true);
    });

    test("minesweeper_speedster requires bestTime > 0 and <= 60", () => {
        const badge = BADGES.find((b) => b.id === "minesweeper_speedster");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ minesweeperBestTime: 999 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperBestTime: 61 }))).toBe(false);
        expect(badge!.condition(createStats({ minesweeperBestTime: 60 }))).toBe(true);
        expect(badge!.condition(createStats({ minesweeperBestTime: 30 }))).toBe(true);
    });
});

describe("Badge System Logic (Dynamic Badges)", () => {
    test("first_step badge should always be true", () => {
        const badge = BADGES.find((b) => b.id === "first_step");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(true);
    });

    test("explorer badge requires 1 project completion", () => {
        const badge = BADGES.find((b) => b.id === "explorer");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ projectsCompleted: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ projectsCompleted: 1 }))).toBe(true);
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
        const removedIds = ["first_like", "first_comment", "first_publish", "first_collection"];
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

    test("social_butterfly requires comment, discussion or reply", () => {
        const badge = BADGES.find((b) => b.id === "social_butterfly");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ discussionsCreated: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ repliesCount: 1 }))).toBe(true);
    });

    test("social_platinum requires comments + replies >= 500", () => {
        const badge = BADGES.find((b) => b.id === "social_platinum");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ commentsCount: 250, repliesCount: 249 }))).toBe(false);
        expect(badge!.condition(createStats({ commentsCount: 250, repliesCount: 250 }))).toBe(true);
    });

    test("level_bronze requires level >= 5", () => {
        const badge = BADGES.find((b) => b.id === "level_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ level: 4 }))).toBe(false);
        expect(badge!.condition(createStats({ level: 5 }))).toBe(true);
    });

    test("rare badges have condition that always returns false", () => {
        const rareIds = ["early_bird", "bug_hunter", "contributor", "beta_tester", "anniversary"];
        for (const id of rareIds) {
            const badge = BADGES.find((b) => b.id === id);
            expect(badge).toBeDefined();
            expect(badge!.condition(createStats({ projectsCompleted: 999, level: 100 }))).toBe(false);
        }
    });

    test("streak_platinum requires consecutiveDays >= 90", () => {
        const badge = BADGES.find((b) => b.id === "streak_platinum");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ consecutiveDays: 89 }))).toBe(false);
        expect(badge!.condition(createStats({ consecutiveDays: 90 }))).toBe(true);
    });
});
