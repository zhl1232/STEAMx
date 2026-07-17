/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/playground/functionwars-rooms/[id]/fire/route";
import { requireAuth } from "@/lib/api/auth";
import { requireRateLimit } from "@/lib/api/rate-limit";
import { createFunctionWarsInitialInventory } from "@/lib/playground/function-wars-online";
import { simulateFunctionWarsOnlineShot } from "@/lib/playground/function-wars-simulation";
import { createClient } from "@/lib/supabase/server";

const { adminRpcMock } = vi.hoisted(() => ({
    adminRpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
    supabaseAdmin: { rpc: adminRpcMock },
}));

vi.mock("@/lib/api/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/auth")>();
    return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@/lib/api/rate-limit", () => ({
    requireRateLimit: vi.fn(),
}));

vi.mock("@/lib/playground/function-wars-simulation", () => ({
    simulateFunctionWarsOnlineShot: vi.fn(),
}));

describe("POST /api/playground/functionwars-rooms/[id]/fire", () => {
    const createClientMock = createClient as Mock<typeof createClient>;
    const requireAuthMock = requireAuth as Mock<typeof requireAuth>;
    const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>;
    const simulateMock = simulateFunctionWarsOnlineShot as Mock<typeof simulateFunctionWarsOnlineShot>;

    beforeEach(() => {
        vi.clearAllMocks();
        requireAuthMock.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
        } as never);
        requireRateLimitMock.mockResolvedValue(undefined);

        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: "22222222-2222-4222-8222-222222222222",
                host_user_id: "11111111-1111-4111-8111-111111111111",
                guest_user_id: "33333333-3333-4333-8333-333333333333",
                status: "playing",
                map_seed: 7,
                map_id: "symmetric-canyon",
                repairs: [],
                crates: [],
                craters: [],
                inventory: createFunctionWarsInitialInventory(),
                shot_seq: 4,
            },
            error: null,
        });
        createClientMock.mockResolvedValue({
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({ maybeSingle })),
                })),
            })),
        } as never);

        simulateMock.mockReturnValue({
            traces: [],
            summary: {
                damage: { target: "guest", amount: 50 },
                craters: [{ x: 9.4, y: -5.15, radius: 0.72 }],
                picked_crate_ids: [],
            },
            impact: null,
            error: null,
        });
        adminRpcMock.mockResolvedValue({
            data: [{
                ok: true,
                reason: "ok",
                shot_seq: 5,
                current_turn: "guest",
                winner: null,
            }],
            error: null,
        });
    });

    it("ignores a client collision summary and submits the server simulation", async () => {
        const response = await POST(new Request(
            "http://localhost/api/playground/functionwars-rooms/22222222-2222-4222-8222-222222222222/fire",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weapon: "standard",
                    expression: "0",
                    expected_shot_seq: 4,
                    summary: {
                        damage: { target: "guest", amount: 999 },
                        picked_crate_ids: ["forged-crate"],
                    },
                }),
            },
        ), {
            params: Promise.resolve({
                id: "22222222-2222-4222-8222-222222222222",
            }),
        });

        expect(response.status).toBe(200);
        expect(simulateMock).toHaveBeenCalledWith(expect.objectContaining({
            expression: "0",
            role: "host",
            weapon: "standard",
            craters: [],
        }));
        expect(adminRpcMock).toHaveBeenCalledWith(
            "function_wars_fire_authoritative",
            {
                match_uuid: "22222222-2222-4222-8222-222222222222",
                p_actor_user_id: "11111111-1111-4111-8111-111111111111",
                p_expected_shot_seq: 4,
                p_expression: "0",
                p_summary: {
                    damage: { target: "guest", amount: 50 },
                    craters: [{ x: 9.4, y: -5.15, radius: 0.72 }],
                    picked_crate_ids: [],
                },
                p_weapon: "standard",
            },
        );
    });
});
