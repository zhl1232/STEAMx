import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    applyResultToStats,
    computeOnlineResult,
    useGomokuOnline,
} from "./use-gomoku-online";

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const channelRef = { on: vi.fn(), subscribe: vi.fn() };

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        channel: vi.fn(() => channelRef),
        removeChannel: vi.fn(),
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => ({ data: null, error: null })),
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            maybeSingle: vi.fn(() => ({ data: null, error: null })),
                        })),
                    })),
                })),
            })),
        })),
        rpc: vi.fn(() => ({ data: [{ ok: true, reason: "ok" }], error: null })),
    }),
}));

describe("computeOnlineResult", () => {
    it("returns draw when winner is draw", () => {
        expect(computeOnlineResult("draw", "black")).toBe("draw");
    });

    it("returns win when winner equals my color", () => {
        expect(computeOnlineResult("black", "black")).toBe("win");
        expect(computeOnlineResult("white", "white")).toBe("win");
    });

    it("returns loss when winner is the opponent color", () => {
        expect(computeOnlineResult("white", "black")).toBe("loss");
        expect(computeOnlineResult("black", "white")).toBe("loss");
    });

    it("returns null when winner is null or myColor is null", () => {
        expect(computeOnlineResult(null, "black")).toBeNull();
        expect(computeOnlineResult("black", null)).toBeNull();
    });
});

describe("applyResultToStats", () => {
    const base = {
        totalGames: 5,
        wins: 2,
        losses: 2,
        draws: 1,
        gomokuOnlineWins: 1,
    };

    it("increments wins and gomokuOnlineWins on win", () => {
        expect(applyResultToStats(base, "win")).toEqual({
            totalGames: 6,
            wins: 3,
            losses: 2,
            draws: 1,
            gomokuOnlineWins: 2,
        });
    });

    it("increments losses on loss", () => {
        expect(applyResultToStats(base, "loss")).toEqual({
            totalGames: 6,
            wins: 2,
            losses: 3,
            draws: 1,
            gomokuOnlineWins: 1,
        });
    });

    it("increments draws on draw", () => {
        expect(applyResultToStats(base, "draw")).toEqual({
            totalGames: 6,
            wins: 2,
            losses: 2,
            draws: 2,
            gomokuOnlineWins: 1,
        });
    });
});

describe("useGomokuOnline initial state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPlaygroundItemMock.mockReturnValue(null);
    });

    it("exposes empty stats when no stored records exist", async () => {
        const { result } = renderHook(() => useGomokuOnline());
        await waitFor(() => {
            expect(result.current.stats).toEqual({
                totalGames: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                gomokuOnlineWins: 0,
            });
        });
    });

    it("derives myColor as null before a match is loaded", async () => {
        const { result } = renderHook(() => useGomokuOnline());
        await waitFor(() => {
            expect(result.current.myColor).toBeNull();
            expect(result.current.phase).toBe("idle");
        });
        // 初始无对局不应写战绩
        expect(setPlaygroundItemMock).not.toHaveBeenCalled();
    });
});
