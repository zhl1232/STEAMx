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
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
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

function renderHome() {
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
  const heading = screen.getByRole("heading", { level: 1 });
  const section = heading.closest("section")!;
  return { heading, section, hero: within(section) };
}

describe("HomeShowcase hero", () => {
  it("keeps one H1 with compact mobile copy and the unchanged desktop introduction", () => {
    const { heading, hero } = renderHome();

    expect(screen.getByText(BRAND_FULL_NAME)).toBeInTheDocument();
    // Shared core tagline (about / welcome) stays unchanged; the homepage hero has its own headline.
    expect(BRAND_HERO_TITLE).toBe("兴趣是最好的老师");
    expect(screen.queryByText(BRAND_HERO_TITLE)).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // CSS visibility (checked in smoke E2E) determines the accessible name, not a stale aria-label.
    expect(heading).not.toHaveAttribute("aria-label");
    expect(within(heading).getByText("陪孩子，一起动手做")).toHaveClass("md:hidden");
    const desktopTitle = heading.querySelector("span.hidden");
    expect(desktopTitle).toHaveClass("md:block");
    expect(desktopTitle).toHaveTextContent(BRAND_HOME_HERO_TITLE);
    expect(hero.getByText("搭积木 · 做实验 · 学编程 · 观察自然")).toHaveClass("md:hidden");
    expect(hero.getByText(BRAND_HERO_SUBTITLE)).toHaveClass("hidden", "md:inline");
    expect(hero.getByText(BRAND_HOME_HERO_GUIDE)).toHaveClass("hidden", "md:block");
    expect(screen.queryByText("把好奇心做成作品")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "了解我们的理念" })).not.toBeInTheDocument();
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
  });

  it("moves the mobile guide into the hero with a 44px target and keeps the old position desktop-only", () => {
    const { hero } = renderHome();
    const guide = hero.getByRole("link", { name: "探索指南" });
    expect(guide).toHaveAttribute("href", "/start");
    expect(guide).toHaveClass("inline-flex", "min-h-11", "md:hidden");
    const guides = screen.getAllByRole("link", { name: "探索指南" });
    expect(guides).toHaveLength(2);
    expect(guides[0]).toBe(guide);
    expect(guides[1]).toHaveAttribute("href", "/start");
    expect(guides[1]).toHaveClass("hidden", "md:inline-flex");
  });

  it("keeps both original desktop buttons while removing them from the mobile layout", () => {
    const { hero } = renderHome();
    const courses = hero.getByRole("link", { name: "挑一节免费课程" });
    const projects = hero.getByRole("link", { name: "看看动手项目" });
    expect(courses).toHaveAttribute("href", "/courses");
    expect(projects).toHaveAttribute("href", "/explore");
    expect(courses.parentElement).toBe(projects.parentElement);
    expect(courses.parentElement).toHaveClass("hidden", "md:flex");
  });

  it("preserves the free-course recommendation, other shortcuts and the desktop course entry", () => {
    const { section } = renderHome();
    const recommendation = screen.getByRole("link", { name: /积木搭建，从这里开始/ });
    expect(recommendation).toHaveAttribute("href", "/courses");
    expect(recommendation).toHaveTextContent("免费积木课，跟着 3D 步骤一起搭");
    expect(section).not.toContainElement(recommendation);
    expect(screen.getByRole("link", { name: "免费积木课" })).toHaveAttribute("href", "/courses");
    const leaderboardLinks = screen.getAllByRole("link", { name: /社区排行榜/ });
    expect(leaderboardLinks).toHaveLength(2);
    for (const link of leaderboardLinks) expect(link).toHaveAttribute("href", "/leaderboard");
    expect(leaderboardLinks[1].parentElement).toHaveClass("hidden", "md:block");
  });
});
