import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BadgeDisplay } from "@/lib/gamification/types";
import { PublicProfileBadges } from "./public-profile-badges";

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("./badge-icon", () => ({
    BadgeIcon: ({ icon }: { icon: string }) => <span data-testid={`badge-${icon}`} />,
}));

vi.mock("./badge-series-gallery", () => ({
    BadgeSeriesGallery: () => <div data-testid="badge-series-gallery" />,
}));

function createBadges(count: number): BadgeDisplay[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `badge-${index + 1}`,
        name: `徽章 ${index + 1}`,
        description: `徽章 ${index + 1} 描述`,
        icon: `icon-${index + 1}`,
        tier: "bronze",
        seriesKey: `series-${index + 1}`,
        kind: "tiered",
    }));
}

describe("PublicProfileBadges", () => {
    it("shows five badges and counts the other unlocked badges", () => {
        const badges = createBadges(8);

        render(
            <PublicProfileBadges
                featuredBadges={badges}
                allBadges={badges}
                unlockedBadgeIds={badges.map((badge) => badge.id)}
            />,
        );

        expect(screen.getAllByTestId(/badge-icon-/)).toHaveLength(5);
        expect(screen.getByTitle(/查看其余 3 枚已解锁徽章/)).toBeInTheDocument();
        expect(screen.getByText("+3")).toBeInTheDocument();
        expect(screen.queryByText("+40")).not.toBeInTheDocument();
    });

    it("does not show an overflow entry when exactly five badges are unlocked", () => {
        const badges = createBadges(5);

        render(
            <PublicProfileBadges
                featuredBadges={badges}
                allBadges={badges}
                unlockedBadgeIds={badges.map((badge) => badge.id)}
            />,
        );

        expect(screen.getAllByTestId(/badge-icon-/)).toHaveLength(5);
        expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
    });

    it("keeps only the badge gallery entry when the wearer explicitly clears the home list", () => {
        const badges = createBadges(8);

        render(
            <PublicProfileBadges
                featuredBadges={[]}
                allBadges={badges}
                unlockedBadgeIds={badges.map((badge) => badge.id)}
                featuredBadgeIds={[]}
            />,
        );

        expect(screen.getAllByText("徽章图鉴").length).toBeGreaterThan(0);
        expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
        expect(screen.queryAllByTestId(/badge-icon-/)).toHaveLength(0);
    });
});
