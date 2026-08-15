import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BadgeGalleryDialog } from "./badge-gallery-dialog";
import type { Badge, UserStats } from "@/lib/gamification/types";

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
        id: "insect_rank_bronze",
        name: "D 级",
        description: "完成手册 D 级任意一套九宫格",
        icon: "butterfly",
        tier: "bronze",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_silver",
        name: "C 级",
        description: "完成手册 C 级任意一套九宫格",
        icon: "butterfly",
        tier: "silver",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_gold",
        name: "B 级",
        description: "完成手册 B 级任意一套九宫格",
        icon: "butterfly",
        tier: "gold",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_platinum",
        name: "A 级",
        description: "完成手册 A 级任意一套九宫格",
        icon: "butterfly",
        tier: "platinum",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "insect_rank_diamond",
        name: "S 级",
        description: "完成手册 S 级任一项挑战",
        icon: "butterfly",
        tier: "diamond",
        seriesKey: "insect_rank",
        kind: "tiered",
        condition: () => false,
    },
];

describe("BadgeGalleryDialog", () => {
    it("shows only the highest unlocked tier in the all tab", () => {
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        expect(screen.getByText("实验室常客")).toBeInTheDocument();
        expect(screen.queryByText("好奇观察员")).not.toBeInTheDocument();
        expect(screen.queryByText("假说验证者")).not.toBeInTheDocument();
        expect(screen.queryByText("真理追寻者")).not.toBeInTheDocument();
    });

    it("opens the remaining tiers in the detail dialog", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("button", { name: /实验室常客/ }));

        expect(screen.getByText("好奇观察员")).toBeInTheDocument();
        expect(screen.getByText("假说验证者")).toBeInTheDocument();
        expect(screen.getByText("真理追寻者")).toBeInTheDocument();
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

        expect(screen.getByText("A 级")).toBeInTheDocument();
        expect(screen.queryByText("S 级")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /A 级/ }));

        expect(screen.getByText("已升到最高品质")).toBeInTheDocument();
        expect(screen.queryByText("S 级")).not.toBeInTheDocument();
    });
});
