import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecommendationPanel } from "./recommendation-panel";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

describe("RecommendationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the current recommendation list when rotating", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: 22,
            title: "第二批推荐",
            author: "新作者",
            author_id: "user-22",
            image: "/next.webp",
            category: "技术",
            likes: 920,
          },
        ],
        nextOffset: 8,
        hasMore: false,
        mode: "popular-fallback",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <RecommendationPanel
        initialProjects={[
          {
            id: 11,
            title: "第一批推荐",
            author: "原作者",
            author_id: "user-11",
            image: "/initial.webp",
            category: "科学",
            likes: 320,
          },
        ]}
        initialMode="personalized"
        initialNextOffset={4}
        initialHasMore
        excludeProjectIds={[1, 2, 3, 4, 5]}
      />,
    );

    expect(screen.getByText("第一批推荐")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "换一批" }));

    await screen.findByText("第二批推荐");
    await waitFor(() => {
      expect(screen.queryByText("第一批推荐")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/home/recommendations?"),
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(fetchMock.mock.calls[0][0]).toContain("limit=8");
  });
});
