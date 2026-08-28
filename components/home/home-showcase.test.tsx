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
  it("mentions 少儿编程, 积木, and 观鸟 without jargon stuffing", () => {
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

    expect(screen.getByText("STEAMX · 史迪姆")).toBeInTheDocument();
    expect(screen.getByText("把好奇心做成作品")).toBeInTheDocument();
    expect(screen.getByText("少儿编程 · 积木 · 观鸟")).toBeInTheDocument();
    expect(screen.getByText("给孩子做少儿编程、积木和观鸟。动手搭、去观察。")).toBeInTheDocument();
    expect(screen.queryByText(/项目式学习/)).not.toBeInTheDocument();
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
  });
});
