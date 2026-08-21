import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BadgeDisplay } from "@/lib/gamification/types";
import { BadgeGalleryDialog } from "./badge-gallery-dialog";

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({
        user: { id: "test-user" },
        profile: { equipped_title: null, featured_badge_ids: null },
        refreshProfile: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

const badges: BadgeDisplay[] = Array.from({ length: 6 }, (_, index) => ({
    id: `manage-${index + 1}`,
    name: `管理徽章 ${index + 1}`,
    description: `用于测试主页佩戴顺序 ${index + 1}`,
    icon: "star",
    seriesKey: `manage-series-${index + 1}`,
    kind: "single",
}));

beforeEach(() => {
    mockFetch.mockReset().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);
});

describe("BadgeGalleryDialog with Radix Dialog", () => {
    it("keeps the detail dialog usable while the replacement dialog is open", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={badges}
                unlockedBadges={new Set(badges.map((badge) => badge.id))}
                featuredBadgeIds={["manage-1", "manage-2", "manage-3", "manage-4", "manage-5"]}
            >
                <button type="button">打开图鉴</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: "打开图鉴" }));
        await user.click(screen.getByRole("button", { name: /管理徽章 6，已获得/ }));
        await user.click(screen.getByRole("button", { name: "替换佩戴" }));

        expect(screen.getByRole("dialog", { name: "选择要替换的徽章" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "替换第 3 枚：管理徽章 3" }));
        await user.click(screen.getByRole("button", { name: "确认替换" }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/profile/equipped-honor",
                expect.objectContaining({
                    body: JSON.stringify({
                        featured_badge_ids: ["manage-1", "manage-2", "manage-6", "manage-4", "manage-5"],
                    }),
                }),
            );
        });
    });
});
