import { describe, expect, it } from "vitest";

import {
    applyResultToStats,
    computeMemoryOnlineResult,
} from "./use-memory-online";

describe("computeMemoryOnlineResult", () => {
    it("returns null when there is no winner yet", () => {
        expect(computeMemoryOnlineResult(null, "host")).toBeNull();
    });

    it("records a draw regardless of role", () => {
        expect(computeMemoryOnlineResult("draw", "host")).toBe("draw");
        expect(computeMemoryOnlineResult("draw", "guest")).toBe("draw");
        expect(computeMemoryOnlineResult("draw", null)).toBe("draw");
    });

    it("returns null when a side won but my role is unknown", () => {
        expect(computeMemoryOnlineResult("host", null)).toBeNull();
    });

    it("scores win/loss by comparing winner to my role", () => {
        expect(computeMemoryOnlineResult("host", "host")).toBe("win");
        expect(computeMemoryOnlineResult("host", "guest")).toBe("loss");
        expect(computeMemoryOnlineResult("guest", "guest")).toBe("win");
        expect(computeMemoryOnlineResult("guest", "host")).toBe("loss");
    });
});

describe("applyResultToStats", () => {
    const base = { totalGames: 0, wins: 0, losses: 0, draws: 0, memoryOnlineWins: 0 };

    it("increments win counters", () => {
        expect(applyResultToStats(base, "win")).toEqual({
            totalGames: 1,
            wins: 1,
            losses: 0,
            draws: 0,
            memoryOnlineWins: 1,
        });
    });

    it("increments loss without touching win counters", () => {
        expect(applyResultToStats(base, "loss")).toEqual({
            totalGames: 1,
            wins: 0,
            losses: 1,
            draws: 0,
            memoryOnlineWins: 0,
        });
    });

    it("increments draw without touching win counters", () => {
        expect(applyResultToStats(base, "draw")).toEqual({
            totalGames: 1,
            wins: 0,
            losses: 0,
            draws: 1,
            memoryOnlineWins: 0,
        });
    });

    it("accumulates across calls", () => {
        let stats = applyResultToStats(base, "win");
        stats = applyResultToStats(stats, "loss");
        stats = applyResultToStats(stats, "win");
        expect(stats).toEqual({
            totalGames: 3,
            wins: 2,
            losses: 1,
            draws: 0,
            memoryOnlineWins: 2,
        });
    });
});
