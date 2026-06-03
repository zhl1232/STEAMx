import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DailyCheckInSync } from "./daily-check-in-sync";

const {
    mockAuthState,
    mockRefreshProfile,
    mockRpc,
    mockToast,
    mockUpsert,
    mockLoggerError,
} = vi.hoisted(() => ({
    mockAuthState: {
        user: null as User | null,
    },
    mockRefreshProfile: vi.fn(),
    mockRpc: vi.fn(),
    mockToast: vi.fn(),
    mockUpsert: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({
        user: mockAuthState.user,
        refreshProfile: mockRefreshProfile,
    }),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        rpc: mockRpc,
        from: vi.fn(() => ({
            upsert: mockUpsert,
        })),
    }),
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/features/gamification/achievement-toast", () => ({
    AchievementToast: ({ title, description }: { title: string; description: string }) => (
        <div>
            {title}
            {description}
        </div>
    ),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        error: mockLoggerError,
    },
}));

function makeUser(overrides: Partial<User> = {}): User {
    return {
        id: "user-1",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-06-03T00:00:00.000Z",
        ...overrides,
    } as User;
}

function renderSync(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const result = render(
        <QueryClientProvider client={queryClient}>
            <DailyCheckInSync />
        </QueryClientProvider>,
    );

    return { ...result, queryClient };
}

describe("DailyCheckInSync", () => {
    beforeEach(() => {
        mockAuthState.user = null;
        mockRefreshProfile.mockReset();
        mockRpc.mockReset();
        mockToast.mockReset();
        mockUpsert.mockReset();
        mockLoggerError.mockReset();
    });

    it("does nothing without an authenticated user", async () => {
        renderSync();

        await Promise.resolve();

        expect(mockRpc).not.toHaveBeenCalled();
    });

    it("calls daily_check_in when a user appears", async () => {
        mockRpc.mockResolvedValue({ data: { is_new_day: false }, error: null });
        const { rerender, queryClient } = renderSync();

        mockAuthState.user = makeUser();
        rerender(
            <QueryClientProvider client={queryClient}>
                <DailyCheckInSync />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(mockRpc).toHaveBeenCalledWith("daily_check_in");
        });
    });

    it("does not call daily_check_in repeatedly for the same user during one mount", async () => {
        mockAuthState.user = makeUser();
        mockRpc.mockResolvedValue({ data: { is_new_day: false }, error: null });
        const { rerender, queryClient } = renderSync();

        await waitFor(() => {
            expect(mockRpc).toHaveBeenCalledTimes(1);
        });

        mockAuthState.user = makeUser({ id: "user-1" });
        rerender(
            <QueryClientProvider client={queryClient}>
                <DailyCheckInSync />
            </QueryClientProvider>,
        );

        await Promise.resolve();

        expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it("refreshes reward state and shows a toast for a new check-in day", async () => {
        mockAuthState.user = makeUser();
        mockRpc.mockResolvedValue({
            data: {
                is_new_day: true,
                streak: 3,
                xp_granted: 13,
                coins_granted: 2,
            },
            error: null,
        });
        mockRefreshProfile.mockResolvedValue(undefined);
        const { queryClient } = renderSync();
        const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

        await waitFor(() => {
            expect(mockRefreshProfile).toHaveBeenCalled();
        });

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["coin_logs"] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["gamification", "stats", "user-1"] });
        expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({
                duration: 4000,
                description: expect.anything(),
            }),
        );
    });

    it("does not refresh or toast when the user already checked in today", async () => {
        mockAuthState.user = makeUser();
        mockRpc.mockResolvedValue({
            data: { is_new_day: false, streak: 3, xp_granted: 0, coins_granted: 0 },
            error: null,
        });
        renderSync();

        await waitFor(() => {
            expect(mockRpc).toHaveBeenCalledWith("daily_check_in");
        });

        expect(mockRefreshProfile).not.toHaveBeenCalled();
        expect(mockToast).not.toHaveBeenCalled();
    });

    it("recovers a missing profile and retries the daily check-in", async () => {
        mockAuthState.user = makeUser({
            phone: "+8613800138000",
            user_metadata: { full_name: "探索者" },
        });
        mockRpc
            .mockResolvedValueOnce({ data: null, error: { code: "23503", message: "missing profile" } })
            .mockResolvedValueOnce({
                data: {
                    is_new_day: true,
                    streak: 1,
                    xp_granted: 11,
                    coins_granted: 2,
                },
                error: null,
            });
        mockUpsert.mockResolvedValue({ error: null });
        mockRefreshProfile.mockResolvedValue(undefined);

        renderSync();

        await waitFor(() => {
            expect(mockRpc).toHaveBeenCalledTimes(2);
        });

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "user-1",
                display_name: "探索者",
                avatar_url: expect.stringMatching(/^\/avatars\/default-\d+\.svg$/),
            }),
            { onConflict: "id", ignoreDuplicates: true },
        );
        expect(mockRefreshProfile).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalled();
    });
});
