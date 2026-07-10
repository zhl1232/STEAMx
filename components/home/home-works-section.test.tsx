import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Work } from "@/lib/mappers/types";
import { HomeWorksSection } from "./home-works-section";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/features/works/work-card-grid", () => ({
  WorkCardGrid: ({ works }: { works: Work[] }) => (
    <div>{works.map((work) => <span key={work.id}>{work.source?.title}</span>)}</div>
  ),
}));

function makeWork(id: number, title: string): Work {
  return {
    id,
    userId: "user-1",
    projectId: id,
    author: "测试用户",
    completedAt: "2026/7/10",
    proofImages: ["/work.webp"],
    isPublic: true,
    likes: 0,
    coins: 0,
    status: "approved",
    recordKind: "final",
    source: { type: "project", id, title, href: `/project/${id}` },
  };
}

describe("HomeWorksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the next four-work batch and replaces the current list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        works: [makeWork(2, "第二批作品")],
        nextOffset: 5,
        hasMore: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeWorksSection
        initialData={{
          works: [makeWork(1, "第一批作品")],
          nextOffset: 1,
          hasMore: true,
        }}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "换一批" }));

    expect(await screen.findByText("第二批作品")).toBeInTheDocument();
    expect(screen.queryByText("第一批作品")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/explore/works?limit=4&offset=1",
      { method: "GET", cache: "no-store" },
    );
  });
});
