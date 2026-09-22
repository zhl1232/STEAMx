import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BRAND_FULL_NAME, BRAND_HERO_TITLE } from "@/lib/brand";

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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(BRAND_HERO_TITLE.replace("，", ""));
    expect(screen.getByText("从积木、科学到自然探索，让孩子在真实项目中学习与创造。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开始探索项目/ })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("link", { name: "了解我们的理念" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "免费积木课" })).toHaveAttribute("href", "/courses");
    expect(screen.queryByText(/项目式学习/)).not.toBeInTheDocument();
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
  });
});
