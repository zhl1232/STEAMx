/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST as createRoom } from "@/app/api/playground/functionwars-rooms/route";
import { POST as joinRoom } from "@/app/api/playground/functionwars-rooms/join/route";
import { requireAuth } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
    supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/api/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/auth")>();
    return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@/lib/api/rate-limit", () => ({
    requireRateLimit: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const ACTIVE_MATCH_ERROR = "你已有进行中的函数战争对局，请先返回并结束该对局";
const TARGET_MATCH_ID = "11111111-1111-4111-8111-111111111111";

const waitingMatch = {
    id: TARGET_MATCH_ID,
    code: "ABC234",
    host_user_id: "host-user",
    guest_user_id: null,
    status: "waiting",
    map_id: "symmetric-canyon",
    map_seed: 7,
};

function mockActiveRooms(data: unknown[]) {
    const limit = vi.fn().mockResolvedValue({ data, error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const inStatus = vi.fn().mockReturnValue({ or });
    return { select: vi.fn().mockReturnValue({ in: inStatus }) };
}

function mockMatchLookup(match = waitingMatch) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: match, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    return { select: vi.fn().mockReturnValue({ eq }) };
}

function mockOtherActiveMatch(data: { id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const neq = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ neq });
    const inStatus = vi.fn().mockReturnValue({ or });
    return { select: vi.fn().mockReturnValue({ in: inStatus }) };
}

describe("Function Wars room lifecycle routes", () => {
    const createClientMock = createClient as Mock<typeof createClient>;
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>;
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>;
    const fromMock = supabaseAdmin.from as Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        createClientMock.mockResolvedValue({} as never);
        requireAuthMock.mockResolvedValue({ id: "joining-user" } as never);
        requireRateLimitMock.mockResolvedValue(undefined);
    });

    it("rejects room creation while the user is already playing", async () => {
        fromMock.mockReturnValueOnce(mockActiveRooms([{
            ...waitingMatch,
            host_user_id: "joining-user",
            guest_user_id: "other-user",
            status: "playing",
        }]));

        const response = await createRoom(new Request(
            "http://localhost/api/playground/functionwars-rooms",
            { method: "POST", body: JSON.stringify({}) },
        ));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: ACTIVE_MATCH_ERROR });
    });

    it("maps a concurrent create constraint violation to the active-room conflict", async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: "23505", message: "function_wars_user_already_active" },
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        fromMock
            .mockReturnValueOnce(mockActiveRooms([]))
            .mockReturnValueOnce({ insert });

        const response = await createRoom(new Request(
            "http://localhost/api/playground/functionwars-rooms",
            { method: "POST", body: JSON.stringify({}) },
        ));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: ACTIVE_MATCH_ERROR });
    });

    it("rejects joining when the user has another active match", async () => {
        fromMock
            .mockReturnValueOnce(mockMatchLookup())
            .mockReturnValueOnce(mockOtherActiveMatch({
                id: "22222222-2222-4222-8222-222222222222",
            }));

        const response = await joinRoom(new Request(
            "http://localhost/api/playground/functionwars-rooms/join",
            { method: "POST", body: JSON.stringify({ code: waitingMatch.code }) },
        ));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: ACTIVE_MATCH_ERROR });
    });

    it("maps a concurrent join constraint violation to the active-room conflict", async () => {
        const updateChain = {
            eq: vi.fn(),
            is: vi.fn().mockResolvedValue({
                count: null,
                error: { code: "23505", message: "function_wars_user_already_active" },
            }),
        };
        updateChain.eq.mockReturnValue(updateChain);
        fromMock
            .mockReturnValueOnce(mockMatchLookup())
            .mockReturnValueOnce(mockOtherActiveMatch(null))
            .mockReturnValueOnce({ update: vi.fn().mockReturnValue(updateChain) });

        const response = await joinRoom(new Request(
            "http://localhost/api/playground/functionwars-rooms/join",
            { method: "POST", body: JSON.stringify({ code: waitingMatch.code }) },
        ));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: ACTIVE_MATCH_ERROR });
    });
});
