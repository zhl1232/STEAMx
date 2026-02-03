
import { BADGES } from "../lib/gamification/badges";
import { UserStats } from "../lib/gamification/types";

// Helper to create a base stats object
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
    ...overrides
});

describe('Badge System Logic', () => {

    // 1. Initial Badge
    test('First Step badge should always be true', () => {
        const badge = BADGES.find(b => b.id === 'first_step');
        expect(badge).toBeDefined();
        expect(badge!.condition(createStats())).toBe(true);
    });

    // 2. Project Completion Badges
    test('Explorer badge requires 1 project completion', () => {
        const badge = BADGES.find(b => b.id === 'explorer');
        expect(badge).toBeDefined();

        expect(badge!.condition(createStats({ projectsCompleted: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ projectsCompleted: 1 }))).toBe(true);
        expect(badge!.condition(createStats({ projectsCompleted: 5 }))).toBe(true);
    });

    // 3. Category Specific Badges (Science)
    test('Science Beginner requires 1 science project', () => {
        const badge = BADGES.find(b => b.id === 'science_beginner');
        expect(badge!.condition(createStats({ scienceCompleted: 0 }))).toBe(false);
        expect(badge!.condition(createStats({ scienceCompleted: 1 }))).toBe(true);
    });

    test('Science Master requires 30 science projects', () => {
        const badge = BADGES.find(b => b.id === 'science_master');
        expect(badge!.condition(createStats({ scienceCompleted: 29 }))).toBe(false);
        expect(badge!.condition(createStats({ scienceCompleted: 30 }))).toBe(true);
    });

    // 4. Social Badges
    test('Social Butterfly requires discussion or reply', () => {
        const badge = BADGES.find(b => b.id === 'social_butterfly');

        // Neither
        expect(badge!.condition(createStats())).toBe(false);
        // Only discussion
        expect(badge!.condition(createStats({ discussionsCreated: 1 }))).toBe(true);
        // Only reply
        expect(badge!.condition(createStats({ repliesCount: 1 }))).toBe(true);
    });

    test('Community Pillar requires sum of comments and replies >= 200', () => {
        const badge = BADGES.find(b => b.id === 'community_pillar');

        expect(badge!.condition(createStats({ commentsCount: 100, repliesCount: 99 }))).toBe(false); // 199
        expect(badge!.condition(createStats({ commentsCount: 100, repliesCount: 100 }))).toBe(true); // 200
        expect(badge!.condition(createStats({ commentsCount: 0, repliesCount: 200 }))).toBe(true); // 200
    });

    // 5. Level Badges
    test('Level 5 Badge', () => {
        const badge = BADGES.find(b => b.id === 'level_5');
        expect(badge!.condition(createStats({ level: 4 }))).toBe(false);
        expect(badge!.condition(createStats({ level: 5 }))).toBe(true);
    });

    // 6. All Rounder (Category Variety)
    test('All Rounder requires 1 of each category', () => {
        const badge = BADGES.find(b => b.id === 'all_rounder');

        const almostThere = createStats({
            scienceCompleted: 1,
            techCompleted: 1,
            engineeringCompleted: 1,
            artCompleted: 1,
            mathCompleted: 0 // Missing Math
        });

        const done = createStats({
            scienceCompleted: 1,
            techCompleted: 1,
            engineeringCompleted: 1,
            artCompleted: 1,
            mathCompleted: 1
        });

        expect(badge!.condition(almostThere)).toBe(false);
        expect(badge!.condition(done)).toBe(true);
    });
});
