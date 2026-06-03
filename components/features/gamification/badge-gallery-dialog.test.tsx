import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BadgeGalleryDialog } from "./badge-gallery-dialog";
import type { Badge } from "@/lib/gamification/types";

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

vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: () => null,
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
}));

const badges: Badge[] = [
    {
        id: "science_expert_bronze",
        name: "好奇观察员",
        description: "完成科学类项目 3 个",
        icon: "atom",
        tier: "bronze",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "science_expert_silver",
        name: "实验室常客",
        description: "完成科学类项目 10 个",
        icon: "atom",
        tier: "silver",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => true,
    },
    {
        id: "science_expert_gold",
        name: "假说验证者",
        description: "完成科学类项目 20 个",
        icon: "atom",
        tier: "gold",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => false,
    },
    {
        id: "science_expert_platinum",
        name: "真理追寻者",
        description: "完成科学类项目 50 个",
        icon: "atom",
        tier: "platinum",
        seriesKey: "science_expert",
        kind: "tiered",
        condition: () => false,
    },
];

describe("BadgeGalleryDialog", () => {
    it("shows every tiered badge in the all tab", () => {
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        expect(screen.getByText("好奇观察员")).toBeInTheDocument();
        expect(screen.getByText("实验室常客")).toBeInTheDocument();
        expect(screen.getByText("假说验证者")).toBeInTheDocument();
        expect(screen.getByText("真理追寻者")).toBeInTheDocument();
    });

    it("shows all unlocked tiers instead of only the highest unlocked tier", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("tab", { name: /已拥有/ }));

        expect(screen.getByText("好奇观察员")).toBeInTheDocument();
        expect(screen.getByText("实验室常客")).toBeInTheDocument();
        expect(screen.queryByText("假说验证者")).not.toBeInTheDocument();
        expect(screen.queryByText("真理追寻者")).not.toBeInTheDocument();
    });

    it("shows every locked tier instead of only the next locked tier", async () => {
        const user = userEvent.setup();
        render(
            <BadgeGalleryDialog badges={badges} unlockedBadges={new Set(["science_expert_bronze", "science_expert_silver"])}>
                <button type="button">全部徽章</button>
            </BadgeGalleryDialog>
        );

        await user.click(screen.getByRole("tab", { name: /未解锁/ }));

        expect(screen.queryByText("好奇观察员")).not.toBeInTheDocument();
        expect(screen.queryByText("实验室常客")).not.toBeInTheDocument();
        expect(screen.getByText("假说验证者")).toBeInTheDocument();
        expect(screen.getByText("真理追寻者")).toBeInTheDocument();
    });
});
