import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BRAND_FULL_NAME,
  BRAND_HERO_SUBTITLE,
  BRAND_HERO_TITLE,
  BRAND_HOME_HERO_GUIDE,
  BRAND_HOME_HERO_TITLE,
} from "@/lib/brand";

import type { ObservationEvent } from "@/lib/mappers/types";
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

function renderHome(observations: ObservationEvent[] = []) {
  render(
    <HomeShowcase
      works={[]}
      worksNextOffset={0}
      worksHasMore={false}
      recentNatureObservations={observations}
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
  it("keeps both headline versions without repeating the brand or secondary introduction", () => {
    const { heading, hero } = renderHome();

    expect(hero.queryByText(BRAND_FULL_NAME)).not.toBeInTheDocument();
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
    const mobileSubtitle = hero.getByRole("link", { name: "搭积木" }).closest("span.md\\:hidden");
    expect(mobileSubtitle).toHaveTextContent("搭积木 · 做实验 · 学编程 · 观察自然");
    expect(hero.getByText(BRAND_HERO_SUBTITLE)).toHaveClass("hidden", "md:inline");
    expect(hero.queryByText(BRAND_HOME_HERO_GUIDE)).not.toBeInTheDocument();
    expect(screen.queryByText("把好奇心做成作品")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "了解我们的理念" })).not.toBeInTheDocument();
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
  });

  it("turns the mobile subtitle words into text links and drops the guide", () => {
    const { hero } = renderHome();
    const expected = [
      ["搭积木", "/courses"],
      ["做实验", "/learn/science"],
      ["学编程", "/learn/scratch"],
      ["观察自然", "/nature"],
    ];
    const links = hero.getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(expected);
    for (const link of links) expect(link).toHaveClass("underline", "py-2.5");
    expect(hero.queryByRole("link", { name: "探索指南" })).not.toBeInTheDocument();
    expect(hero.queryByRole("link", { name: "挑一节免费课程" })).not.toBeInTheDocument();
  });

  it("preserves the mobile free-course recommendation and shortcuts without a duplicate category CTA", () => {
    const { section } = renderHome();
    const recommendation = screen.getByRole("link", { name: /积木搭建，从这里开始/ });
    expect(recommendation).toHaveAttribute("href", "/courses");
    expect(recommendation).toHaveTextContent("免费积木课，跟着 3D 步骤一起搭");
    expect(section).not.toContainElement(recommendation);
    expect(recommendation.closest("div.max-md\\:hidden")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "免费积木课" })).not.toBeInTheDocument();
    const leaderboardLinks = screen.getAllByRole("link", { name: /社区排行榜/ });
    expect(leaderboardLinks).toHaveLength(2);
    for (const link of leaderboardLinks) expect(link).toHaveAttribute("href", "/leaderboard");
    expect(leaderboardLinks[1].parentElement).toHaveClass("hidden", "md:block");
  });
});

function makeObservation(id: number): ObservationEvent {
  return {
    id,
    userId: `observer-${id}`,
    authorDisplayName: `观察者 ${id}`,
    observedAt: "2026-10-01T08:00:00Z",
    createdAt: "2026-10-01T08:00:00Z",
    locationName: "校园花园",
    mediaUrls: [],
    isPublic: true,
    status: "approved",
    identificationStatus: "needs_id",
    likesCount: 0,
    commentsCount: 0,
    species: [],
  };
}

describe("HomeShowcase content hierarchy", () => {
  it("keeps six category destinations without an unrelated free-course link", () => {
    renderHome();
    const section = screen.getByRole("region", { name: "按兴趣探索" });
    expect(within(section).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/explore?category=科学",
      "/explore?category=技术",
      "/explore?category=工程",
      "/explore?category=艺术",
      "/explore?category=数学",
      "/playground",
    ]);
  });

  it("shows real observation records directly with one all-observations entry", () => {
    renderHome([1, 2, 3, 4].map(makeObservation));
    const section = screen.getByRole("region", { name: "自然观察" });
    const nature = within(section);
    expect(nature.getByRole("link", { name: "全部观察" })).toHaveAttribute("href", "/nature/observations");
    expect(nature.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/nature/observations",
      "/nature/observations/1",
      "/nature/observations/2",
      "/nature/observations/3",
    ]);
    expect(nature.queryByText("自然观察频道")).not.toBeInTheDocument();
    expect(nature.queryByText("立即进入")).not.toBeInTheDocument();
    expect(screen.queryByText("身边的真实发现")).not.toBeInTheDocument();
    expect(screen.queryByText("社区正在创作")).not.toBeInTheDocument();
    // The mobile shortcut carousel still has its own nature entry.
    expect(screen.getAllByRole("link", { name: /自然观察频道/ })).toHaveLength(1);
  });

  it("keeps an actionable empty state instead of inventing recent discoveries", () => {
    renderHome();
    const nature = within(screen.getByRole("region", { name: "自然观察" }));
    expect(nature.getByText("还没有自然观察记录")).toBeInTheDocument();
    expect(nature.getByRole("link", { name: "发布一次观察" })).toHaveAttribute("href", "/nature/submit");
    expect(nature.getByRole("link", { name: "全部观察" })).toHaveAttribute("href", "/nature/observations");
  });
});
