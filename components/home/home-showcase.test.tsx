import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  it("weaves approved SEO terms into mobile and desktop copy", () => {
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

    expect(screen.getByText("STEAMX · 史迪姆 · 少儿STEAM社区")).toBeInTheDocument();
    expect(screen.getByText("把好奇心做成作品")).toBeInTheDocument();
    expect(screen.getByText("少儿STEAM · 项目式学习与科创")).toBeInTheDocument();
    expect(screen.getByText("做项目式学习和科创：上积木课，去自然观察、鸟类观察。")).toBeInTheDocument();
  });
});
