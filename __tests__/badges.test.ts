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
    ...overrides,
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

    test("intro_likes_bronze requires likesGiven >= 1", () => {
        const badge = BADGES.find((b) => b.id === "intro_likes_bronze");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ likesGiven: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ likesGiven: 1 }))).toBe(true);
    });

    test("intro_likes_silver requires likesGiven >= 10", () => {
        const badge = BADGES.find((b) => b.id === "intro_likes_silver");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ likesGiven: 9 }))).toBe(false);
        expect(badge!.condition(createStats({ likesGiven: 10 }))).toBe(true);
    });

    test("science_expert_gold requires scienceCompleted >= 50", () => {
        const badge = BADGES.find((b) => b.id === "science_expert_gold");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats({ scienceCompleted: 49 }))).toBe(false);
        expect(badge!.condition(createStats({ scienceCompleted: 50 }))).toBe(true);
    });

    test("social_butterfly requires discussion or reply", () => {
        const badge = BADGES.find((b) => b.id === "social_butterfly");
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(false);
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
