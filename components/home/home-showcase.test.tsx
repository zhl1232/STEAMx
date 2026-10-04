import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BRAND_FULL_NAME,
  BRAND_HERO_SUBTITLE,
  BRAND_HERO_TITLE,
  BRAND_HOME_HERO_TITLE,
  BRAND_POSITIONING,
  BRAND_TAGLINE,
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
  it("keeps the brand, concise introduction, and exploration entry visible", () => {
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
    expect(BRAND_HOME_HERO_TITLE).toBe("从兴趣出发，在动手中成长");
    expect(BRAND_HERO_SUBTITLE).toBe("在真实项目中动手探索，学会拆解问题、持续迭代。");
    expect(screen.getByText(BRAND_HERO_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByText(BRAND_POSITIONING)).toHaveTextContent("少儿 STEAM 项目式学习平台");
    expect(screen.queryByText(BRAND_HERO_TITLE)).not.toBeInTheDocument();

    // Desktop hero: headline「从兴趣出发，在动手中成长」, one line per clause.
    const heading = screen.getByRole("heading", { level: 1 });
    const desktopHeadline = heading.querySelector(`[aria-label="${BRAND_HOME_HERO_TITLE}"]`);
    expect(desktopHeadline).not.toBeNull();
    expect(desktopHeadline).toHaveClass("hidden", "md:block");
    expect(Array.from(desktopHeadline?.children ?? [], (el) => el.textContent)).toEqual([
      "从兴趣出发",
      "在动手中成长",
    ]);
    expect(heading).not.toHaveTextContent(BRAND_HERO_TITLE);

    // Mobile hero: slogan (h1) → headline (single line) → positioning, each on its own line.
    const mobileSlogan = heading.querySelector(`[aria-label="${BRAND_TAGLINE}"]`);
    expect(mobileSlogan).toHaveClass("md:hidden");
    expect(mobileSlogan).toHaveTextContent("探索·创造·成长");
    const mobileHeadline = screen.getByText(BRAND_HOME_HERO_TITLE);
    expect(mobileHeadline.tagName).toBe("P");
    expect(mobileHeadline).toHaveClass("md:hidden", "whitespace-nowrap");
    expect(mobileHeadline.nextElementSibling).toHaveTextContent(BRAND_POSITIONING);
    expect(screen.queryByText("把好奇心做成作品")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开始探索项目/ })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("link", { name: "了解我们的理念" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "免费积木课" })).toHaveAttribute("href", "/courses");
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
  });
});
