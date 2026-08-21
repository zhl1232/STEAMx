import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeGalleryDialog } from "./badge-gallery-dialog";
import type { Badge, UserStats } from "@/lib/gamification/types";

const mockAuth = vi.hoisted(() => ({
    user: { id: "test-user" },
    profile: { equipped_title: null, featured_badge_ids: null },
    refreshProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => mockAuth,
}));

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children, open = true }: { children: React.ReactNode; open?: boolean }) => <div>{open ? children : null}</div>,
    DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
    DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
    DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
    DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
    ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

const badges: Badge[] = [
    {
        id: "science_expert_bronze",
        name: "好奇观察员",
        description: "完成 3 个科学项目或观察",
        icon: "atom",
        tier: "bronze",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "science_expert_silver",
        name: "实验室常客",
        description: "完成 10 个科学项目或观察",
        icon: "atom",
        tier: "silver",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "science_expert_gold",
        name: "假说验证者",
        description: "完成 20 个科学项目或观察",
        icon: "atom",
        tier: "gold",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => false,
    },
    {
        id: "science_expert_platinum",
        name: "真理追寻者",
        description: "完成 50 个科学项目或观察",
        icon: "atom",
        tier: "platinum",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => false,
    },
    {
        id: "playground_explorer_bronze",
        name: "游园新客",
        description: "玩过 3 个不同游乐场游戏",
        icon: "compass",
        tier: "bronze",
        seriesKey: "playground_explorer",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "playground_explorer_silver",
        name: "多面玩家",
        description: "玩过 8 个不同游乐场游戏",
        icon: "compass",
        tier: "silver",
        seriesKey: "playground_explorer",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "playground_explorer_gold",
        name: "全能体验官",
        description: "玩过 13 个不同游乐场游戏",
        icon: "compass",
        tier: "gold",
        seriesKey: "playground_explorer",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "playground_explorer_platinum",
        name: "全图鉴玩家",
        description: "玩过 18 个不同游乐场游戏",
        icon: "compass",
        tier: "platinum",
        seriesKey: "playground_explorer",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_bronze",
        name: "初识虫趣",
        description: "完成初级任意一套昆虫九宫格",
        icon: "butterfly",
        tier: "bronze",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_silver",
        name: "寻虫常客",
        description: "完成进阶任意一套昆虫九宫格",
        icon: "butterfly",
        tier: "silver",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_gold",
        name: "寻虫能手",
        description: "完成高级任意一套昆虫九宫格",
        icon: "butterfly",
        tier: "gold",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_platinum",
        name: "虫林专家",
        description: "完成专家任意一套昆虫九宫格",
        icon: "butterfly",
        tier: "platinum",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_diamond",
        name: "昆虫传奇",
        description: "完成任一项专属或神物挑战",
        icon: "butterfly",
        tier: "diamond",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => false,
    },
];

const standaloneBadges: Badge[] = [
    {
        id: "first_step",
        name: "第一步",
        description: "完成注册账号",
        icon: "footprints",
        kind: "single",
        seriesKey: "first_steps",
        condition: () => true,
    },
    {
        id: "explorer",
        name: "初级探索者",
        description: "完成 1 个项目或课时",
        icon: "compass",
        kind: "single",
        seriesKey: "first_steps",
        condition: () => true,
    },
];

const manageBadges: Badge[] = Array.from({ length: 6 }, (_, index) => ({
    id: `manage-${index + 1}`,
    name: `管理徽章 ${index + 1}`,
    description: `用于测试主页佩戴顺序 ${index + 1}`,
    icon: "star",
    seriesKey: `manage-series-${index + 1}`,
    kind: "single",
    condition: () => true,
}));

const mockFetch = vi.hoisted(() => vi.fn());

beforeEach(() => {
    mockAuth.user = { id: "test-user" };
    mockAuth.profile = { equipped_title: null, featured_badge_ids: null };
    mockAuth.refreshProfile.mockClear().mockResolvedValue(undefined);
    mockFetch.mockReset().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);
});

describe("BadgeGalleryDialog", () => {
    it("renders one representative card per tiered series in a flat grid", () => {
        render(
            <BadgeGalleryDialog
                badges={badges}
                unlockedBadges={
                    new Set([
                        "science_expert_bronze",
                        "science_expert_silver",
                        "playground_explorer_bronze",
                        "playground_explorer_silver",
                        "playground_explorer_gold",
                        "playground_explorer_platinum",
                    ])
                }
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        expect(screen.getByRole("button", { name: /实验室常客/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /全图鉴玩家/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /初识虫趣/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /好奇观察员/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /假说验证者/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /游园新客/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /多面玩家/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /全能体验官/ })).not.toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /全部 3/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /已拥有 2/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /未解锁 1/ })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "科学：观察与实验" })).not.toBeInTheDocument();
    });

    it("keeps series details available from a flat badge card", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("button", { name: /实验室常客，已获得/ }));

        expect(screen.getByText("探索科学原理与自然奥秘，完成科学实验与自然观察积累成长。")).toBeInTheDocument();
        expect(screen.getAllByText("实验室常客").length).toBeGreaterThan(1);
        expect(screen.getAllByText("好奇观察员").length).toBeGreaterThan(0);
        expect(screen.getAllByText("假说验证者").length).toBeGreaterThan(0);
        expect(screen.getAllByText("真理追寻者").length).toBeGreaterThan(0);
    });

    it("separates the unlocked tier from the next tier progress", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={badges}
                unlockedBadges={new Set(["science_expert_bronze"])}
                userStats={{ scienceCompleted: 3 } as UserStats}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("button", { name: /好奇观察员，已获得/ }));

        expect(screen.getAllByText("已解锁").length).toBeGreaterThan(0);
        expect(screen.getByText("下一档目标")).toBeInTheDocument();
        expect(screen.getByText(/距离目标还差/)).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "实验室常客进度" })).toHaveAttribute("aria-valuenow", "3");
    });

    it("shows the actual default featured badges and their positions", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={badges}
                unlockedBadges={new Set([
                    "science_expert_bronze",
                    "science_expert_silver",
                    "playground_explorer_bronze",
                    "playground_explorer_silver",
                    "playground_explorer_gold",
                    "playground_explorer_platinum",
                ])}
                featuredBadgeIds={null}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: /实验室常客，已获得/ }));

        expect(screen.getByRole("status", { name: "实验室常客已佩戴" })).toBeInTheDocument();
        expect(screen.getAllByText("全图鉴玩家").length).toBeGreaterThan(0);
        expect(screen.getAllByText("实验室常客").length).toBeGreaterThan(0);
    });

    it("shows the standalone badge that was clicked", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={standaloneBadges}
                unlockedBadges={new Set(["first_step", "explorer"])}
                userBadgeDetails={
                    new Map([
                        ["first_step", { unlockedAt: "2026-08-17T00:00:00.000Z" }],
                        ["explorer", { unlockedAt: "2026-08-17T00:00:00.000Z" }],
                    ])
                }
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("button", { name: /初级探索者，已获得/ }));

        expect(screen.getAllByText("完成 1 个项目或课时").length).toBeGreaterThan(0);
        expect(screen.queryByText("完成注册账号")).not.toBeInTheDocument();
    });

    it("hides the insect diamond tier until it is unlocked", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={badges}
                unlockedBadges={new Set(["insect_rank_bronze", "insect_rank_silver", "insect_rank_gold", "insect_rank_platinum"])}
                userStats={{ insectRank: 4 } as UserStats}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        expect(screen.getByText("虫林专家")).toBeInTheDocument();
        expect(screen.queryByText("昆虫传奇")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /虫林专家/ }));

        expect(screen.getByText("已完成全部档位")).toBeInTheDocument();
        expect(screen.queryByText("昆虫传奇")).not.toBeInTheDocument();
    });

    it("appends an unfeatured badge when the home list has room", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={standaloneBadges}
                unlockedBadges={new Set(["first_step", "explorer"])}
                featuredBadgeIds={["first_step"]}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: /初级探索者，已获得/ }));
        await user.click(screen.getByRole("button", { name: "佩戴到主页" }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/profile/equipped-honor",
                expect.objectContaining({ body: JSON.stringify({ featured_badge_ids: ["first_step", "explorer"] }) }),
            );
        });
        expect(screen.getByText("已佩戴")).toBeInTheDocument();
    });

    it("opens replacement choices instead of silently dropping a badge when full", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={manageBadges}
                unlockedBadges={new Set(manageBadges.map((badge) => badge.id))}
                featuredBadgeIds={["manage-1", "manage-2", "manage-3", "manage-4", "manage-5"]}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: /管理徽章 6，已获得/ }));
        await user.click(screen.getByRole("button", { name: "替换佩戴" }));

        expect(screen.getByText("选择要替换的徽章")).toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();

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

    it("shows a separate remove action for an already worn badge and allows clearing the last one", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={manageBadges}
                unlockedBadges={new Set(manageBadges.map((badge) => badge.id))}
                featuredBadgeIds={["manage-1"]}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: /管理徽章 1，已获得/ }));

        expect(screen.getByRole("status", { name: "管理徽章 1已佩戴" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "卸下" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "卸下" }));
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/profile/equipped-honor",
                expect.objectContaining({ body: JSON.stringify({ featured_badge_ids: [] }) }),
            );
        });
    });

    it("does not render wear controls in read-only mode", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog
                badges={manageBadges}
                unlockedBadges={new Set(manageBadges.map((badge) => badge.id))}
                featuredBadgeIds={["manage-1"]}
                canManageHonors={false}
            >
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>,
        );

        await user.click(screen.getByRole("button", { name: /管理徽章 1，已获得/ }));

        expect(screen.queryByRole("status", { name: "管理徽章 1已佩戴" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "卸下" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "佩戴到主页" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "替换佩戴" })).not.toBeInTheDocument();
    });
});
