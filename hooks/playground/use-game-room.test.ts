import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaseMatchRow } from "@/lib/playground/online-room";
import { useGameRoom } from "./use-game-room";

const { createClientMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(() => ({
        removeChannel: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: { id: "host-user" } }),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: createClientMock,
}));

const waitingMatch: BaseMatchRow = {
    id: "11111111-1111-4111-8111-111111111111",
    code: "ABC234",
    host_user_id: "host-user",
    guest_user_id: null,
    status: "waiting",
    created_at: "2026-07-17T00:00:00.000Z",
    started_at: null,
    finished_at: null,
};

describe("useGameRoom", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_ENABLE_PLAYGROUND_REALTIME", "false");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("returns the host to waiting when they reopen their own invite", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(waitingMatch), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify(waitingMatch), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }));
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() => useGameRoom<BaseMatchRow>({
            table: "function_wars_matches",
            apiBase: "/api/playground/functionwars-rooms",
            channelPrefix: "function-wars-match",
            fetchMatchViaApi: true,
        }));

        await act(async () => {
            await result.current.joinRoom(waitingMatch.code);
        });

        expect(result.current.state).toMatchObject({
            phase: "waiting",
            matchId: waitingMatch.id,
            code: waitingMatch.code,
            match: waitingMatch,
            error: null,
        });
    });
});
