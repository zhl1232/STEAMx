/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import { GET } from "@/app/api/playground/race-rooms/[id]/route"
import { POST as joinRoom } from "@/app/api/playground/race-rooms/join/route"
import { requireAuth } from "@/lib/api/auth"
import { requireRateLimit } from "@/lib/api/rate-limit"
import { logger } from "@/lib/logger"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { callRpc } from "@/lib/supabase/rpc"
import { createClient } from "@/lib/supabase/server"

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
    supabaseAdmin: { from: vi.fn() },
}))

vi.mock("@/lib/api/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/auth")>()
    return { ...actual, requireAuth: vi.fn() }
})

vi.mock("@/lib/api/rate-limit", () => ({
    requireRateLimit: vi.fn(),
}))

vi.mock("@/lib/supabase/rpc", () => ({
    callRpc: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

const MATCH_ID = "11111111-1111-4111-8111-111111111111"

const waitingMatch = {
    id: MATCH_ID,
    code: "ABC234",
    game_key: "game24",
    host_user_id: "host-user",
    guest_user_id: null,
    status: "waiting",
    settings: { durationSeconds: 60, cardValues: [1, 2, 3, 4] },
    host_result: null,
    guest_result: null,
    winner: null,
    created_at: "2026-07-15T00:00:00.000Z",
    started_at: null,
    finished_at: null,
    deadline_at: "2026-07-15T00:15:00.000Z",
    finish_reason: null,
    last_activity_at: "2026-07-15T00:00:00.000Z",
}

function mockJoinDatabase(currentGuestUserId: string) {
    const initialMaybeSingle = vi.fn().mockResolvedValue({
        data: waitingMatch,
        error: null,
    })
    const initialEq = vi.fn().mockReturnValue({ maybeSingle: initialMaybeSingle })
    const initialSelect = vi.fn().mockReturnValue({ eq: initialEq })

    const updateChain = {
        eq: vi.fn(),
        is: vi.fn().mockResolvedValue({ count: 0, error: null }),
    }
    updateChain.eq.mockReturnValue(updateChain)
    const update = vi.fn().mockReturnValue(updateChain)

    const currentSingle = vi.fn().mockResolvedValue({
        data: {
            id: MATCH_ID,
            code: waitingMatch.code,
            game_key: waitingMatch.game_key,
            guest_user_id: currentGuestUserId,
            status: "playing",
            settings: waitingMatch.settings,
        },
        error: null,
    })
    const currentEq = vi.fn().mockReturnValue({ single: currentSingle })
    const currentSelect = vi.fn().mockReturnValue({ eq: currentEq })

    const from = supabaseAdmin.from as Mock
    from
        .mockReturnValueOnce({ select: initialSelect })
        .mockReturnValueOnce({ update })
        .mockReturnValueOnce({ select: currentSelect })
}

describe("playground race room lifecycle routes", () => {
    const createClientMock = createClient as Mock<typeof createClient>
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
    const callRpcMock = callRpc as Mock<typeof callRpc>
    const loggerWarnMock = logger.warn as Mock

    beforeEach(() => {
        vi.clearAllMocks()
        createClientMock.mockResolvedValue({} as never)
        requireAuthMock.mockResolvedValue({ id: "joining-user" } as never)
        requireRateLimitMock.mockResolvedValue(undefined)
        callRpcMock.mockResolvedValue({
            data: [
                {
                    waiting_cancelled: 0,
                    result_timeout_finished: 0,
                    no_result_timeout_cancelled: 0,
                },
            ],
            error: null,
        })
    })

    it("returns 409 and emits a non-sensitive metric when another guest wins the join race", async () => {
        mockJoinDatabase("other-guest")

        const response = await joinRoom(
            new Request("http://localhost/api/playground/race-rooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: waitingMatch.code, game_key: "game24" }),
            }),
        )

        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toEqual({
            error: "加入失败，房间已被他人加入或已关闭",
        })
        expect(loggerWarnMock).toHaveBeenCalledWith(
            "playground race concurrent join conflict",
            {
                event: "playground_race_join_conflict",
                metric_value: 1,
                match_id: MATCH_ID,
                game_key: "game24",
                current_status: "playing",
            },
        )
        const loggedContext = loggerWarnMock.mock.calls[0]?.[1]
        expect(loggedContext).not.toHaveProperty("code")
        expect(loggedContext).not.toHaveProperty("user_id")
    })

    it("observes the conflict when the winning join commits before the initial room read", async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                ...waitingMatch,
                guest_user_id: "other-guest",
                status: "playing",
            },
            error: null,
        })
        const eq = vi.fn().mockReturnValue({ maybeSingle })
        const from = supabaseAdmin.from as Mock
        from.mockReturnValueOnce({
            select: vi.fn().mockReturnValue({ eq }),
        })

        const response = await joinRoom(
            new Request("http://localhost/api/playground/race-rooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: waitingMatch.code, game_key: "game24" }),
            }),
        )

        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toEqual({
            error: "加入失败，房间已被他人加入或已关闭",
        })
        expect(loggerWarnMock).toHaveBeenCalledWith(
            "playground race concurrent join conflict",
            expect.objectContaining({
                event: "playground_race_join_conflict",
                match_id: MATCH_ID,
                current_status: "playing",
            }),
        )
    })

    it("treats a duplicate join from the winning guest as idempotent", async () => {
        mockJoinDatabase("joining-user")

        const response = await joinRoom(
            new Request("http://localhost/api/playground/race-rooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: waitingMatch.code, game_key: "game24" }),
            }),
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            id: MATCH_ID,
            status: "playing",
        })
        expect(loggerWarnMock).not.toHaveBeenCalled()
    })

    it("settles an expired waiting room before returning the authoritative row", async () => {
        const existingMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: MATCH_ID },
            error: null,
        })
        const existingEq = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle })

        const expiredMatch = {
            ...waitingMatch,
            status: "cancelled",
            finish_reason: "waiting_timeout",
            finished_at: "2026-07-15T00:16:00.000Z",
        }
        const freshSingle = vi.fn().mockResolvedValue({ data: expiredMatch, error: null })
        const freshEq = vi.fn().mockReturnValue({ single: freshSingle })
        const from = vi
            .fn()
            .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: existingEq }) })
            .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: freshEq }) })

        createClientMock.mockResolvedValue({ from } as never)
        callRpcMock.mockResolvedValue({
            data: [
                {
                    waiting_cancelled: 1,
                    result_timeout_finished: 0,
                    no_result_timeout_cancelled: 0,
                },
            ],
            error: null,
        })

        const response = await GET(
            new Request(`http://localhost/api/playground/race-rooms/${MATCH_ID}`),
            { params: Promise.resolve({ id: MATCH_ID }) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            id: MATCH_ID,
            status: "cancelled",
            finish_reason: "waiting_timeout",
        })
        expect(loggerWarnMock).toHaveBeenCalledWith(
            "playground race lifecycle auto-settled",
            expect.objectContaining({
                event: "playground_race_timeout_settlement",
                metric_value: 1,
                match_id: MATCH_ID,
            }),
        )
    })
})
