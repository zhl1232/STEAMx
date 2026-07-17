import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    type FunctionWarsMatchRow,
} from "@/lib/playground/function-wars-online";
import {
    FUNCTION_WARS_ROOM_CONFIG,
    useFunctionWarsOnline,
} from "./use-function-wars-online";

const {
    maybeSingleMock,
    refreshMock,
    roomState,
} = vi.hoisted(() => ({
    maybeSingleMock: vi.fn(),
    refreshMock: vi.fn(),
    roomState: { current: null as Record<string, unknown> | null },
}));

vi.mock("@/hooks/playground/use-game-room", () => ({
    useGameRoom: () => roomState.current,
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: vi.fn(() => null),
    setPlaygroundItem: vi.fn(),
}));

vi.mock("@/lib/playground/use-playground-stats-loader", () => ({
    usePlaygroundStatsLoader: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({ maybeSingle: maybeSingleMock }),
            }),
        }),
    }),
}));

function createPlayingMatch(): FunctionWarsMatchRow {
    const map = buildFunctionWarsOnlineMap(7);
    return {
        id: "22222222-2222-4222-8222-222222222222",
        code: "ABC234",
        host_user_id: "11111111-1111-4111-8111-111111111111",
        guest_user_id: "33333333-3333-4333-8333-333333333333",
        status: "playing",
        created_at: "2026-07-16T00:00:00.000Z",
        started_at: "2026-07-16T00:00:00.000Z",
        finished_at: null,
        map_seed: 7,
        map_id: "symmetric-canyon",
        craters: [],
        hp: { host: 100, guest: 100 },
        inventory: createFunctionWarsInitialInventory(),
        crates: map.crates,
        repairs: [],
        current_turn: "host",
        turn_deadline_at: "2026-07-16T00:01:00.000Z",
        last_shot: null,
        shot_seq: 4,
        winner: null,
        last_activity_at: "2026-07-16T00:00:00.000Z",
        host_consecutive_timeouts: 0,
        guest_consecutive_timeouts: 0,
    };
}

describe("useFunctionWarsOnline", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        maybeSingleMock.mockResolvedValue({
            data: {
                stats: {
                    function_wars_stats: { onlineGames: 9, onlineWins: 4 },
                },
            },
            error: null,
        });
        const match = createPlayingMatch();
        roomState.current = {
            state: {
                phase: "playing",
                matchId: match.id,
                code: match.code,
                match,
                error: null,
            },
            createRoom: vi.fn(),
            joinRoom: vi.fn(),
            reconnect: vi.fn(),
            refresh: refreshMock,
            resetLocalState: vi.fn(),
        };
    });

    it("uses authoritative API polling so expired turns progress", () => {
        expect(FUNCTION_WARS_ROOM_CONFIG).toMatchObject({
            table: "function_wars_matches",
            apiBase: "/api/playground/functionwars-rooms",
            channelPrefix: "function-wars-match",
            fetchMatchViaApi: true,
        });
    });

    it("posts only the weapon, expression, and expected sequence when firing", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            ok: true,
            reason: "ok",
            shot_seq: 5,
            current_turn: "guest",
            winner: null,
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() => useFunctionWarsOnline());
        await waitFor(() => expect(result.current.stats).toEqual({ onlineGames: 9, onlineWins: 4 }));

        await act(async () => {
            await result.current.fire("heavy", "x+1");
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/playground/functionwars-rooms/22222222-2222-4222-8222-222222222222/fire");
        expect(JSON.parse(String(options.body))).toEqual({
            weapon: "heavy",
            expression: "x+1",
            expected_shot_seq: 4,
        });
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });
});
