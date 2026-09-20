import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BRAND_DESCRIPTION, BRAND_FULL_NAME, BRAND_HERO_TITLE } from "@/lib/brand";

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
  it("mentions 少儿编程, 积木, and 自然观察 without jargon stuffing", () => {
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
    expect(screen.getByText(BRAND_HERO_TITLE)).toBeInTheDocument();
    expect(screen.getByText(BRAND_DESCRIPTION)).toBeInTheDocument();
    expect(screen.queryByText(/项目式学习/)).not.toBeInTheDocument();
    expect(screen.queryByText(/乐高/)).not.toBeInTheDocument();
    expect(screen.queryByText(/科创/)).not.toBeInTheDocument();
  });
});
