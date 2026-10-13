import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BRAND_FULL_NAME,
  BRAND_HERO_SUBTITLE,
  BRAND_HERO_TITLE,
  BRAND_HOME_HERO_GUIDE,
  BRAND_HOME_HERO_TITLE,
} from "@/lib/brand";

import { HomeShowcase } from "./home-showcase";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const emptyCategoryCounts = {
  科学: 0,
  技术: 0,
  工程: 0,
  艺术: 0,
  数学: 0,
  playgroundGames: 0,
};

describe("HomeShowcase hero", () => {
  it("offers one shared parent-facing heading and direct free-course and project entries", () => {
    render(
      <HomeShowcase
        works={[]}
        worksNextOffset={0}
        worksHasMore={false}
        recentNatureObservations={[]}
        communityFeed={[]}
        categoryTileCounts={emptyCategoryCounts}
        featuredChallenge={null}
      />,
    );

    expect(screen.getByText(BRAND_FULL_NAME)).toBeInTheDocument();
    // Shared core tagline (about / welcome) stays unchanged; the homepage hero has its own headline.
    expect(BRAND_HERO_TITLE).toBe("兴趣是最好的老师");
    expect(screen.queryByText(BRAND_HERO_TITLE)).not.toBeInTheDocument();

    // A single server-rendered heading carries the same introduction at every viewport.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const heading = screen.getByRole("heading", { level: 1, name: BRAND_HOME_HERO_TITLE });
    expect(heading).toHaveTextContent(BRAND_HOME_HERO_TITLE);
    const hero = within(heading.closest("section")!);
    expect(hero.getByText(BRAND_HERO_SUBTITLE)).toBeInTheDocument();
    expect(hero.getByText(BRAND_HOME_HERO_GUIDE)).toBeInTheDocument();
    expect(hero.getByRole("link", { name: "挑一节免费课程" })).toHaveAttribute("href", "/courses");
    expect(hero.getByRole("link", { name: "看看动手项目" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByText("把好奇心做成作品")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "了解我们的理念" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "免费积木课" })).toHaveAttribute("href", "/courses");
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "探索指南" })).toHaveAttribute("href", "/start");
    const leaderboardLinks = screen.getAllByRole("link", { name: /社区排行榜/ });
    expect(leaderboardLinks).toHaveLength(2);
    for (const link of leaderboardLinks) expect(link).toHaveAttribute("href", "/leaderboard");
    expect(leaderboardLinks[1].parentElement).toHaveClass("hidden", "md:block");
  });
});
