import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BadgeGalleryDialog } from "./badge-gallery-dialog";
import type { Badge, UserStats } from "@/lib/gamification/types";

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({
        user: null,
        profile: null,
        refreshProfile: vi.fn(),
    }),
}));

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
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

        expect(screen.getByText("科学类项目和审核通过的观察都算进这一条。")).toBeInTheDocument();
        expect(screen.getAllByText("实验室常客").length).toBeGreaterThan(1);
        expect(screen.getAllByText("好奇观察员").length).toBeGreaterThan(0);
        expect(screen.getAllByText("假说验证者").length).toBeGreaterThan(0);
        expect(screen.getAllByText("真理追寻者").length).toBeGreaterThan(0);
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

        expect(screen.getByText("完成 1 个项目或课时")).toBeInTheDocument();
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

        expect(screen.getByText("已升到最高品质")).toBeInTheDocument();
        expect(screen.queryByText("昆虫传奇")).not.toBeInTheDocument();
    });
});
