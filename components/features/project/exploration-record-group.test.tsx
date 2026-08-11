import type { ReactNode } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectCompletion } from "@/lib/mappers/types"
import { groupCompletionsByExploration } from "@/lib/project/group-exploration-records"

import { ExplorationRecordGroupCard } from "./exploration-record-group"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ src, alt = "" }: { src: string; alt?: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}))

vi.mock("@/hooks/use-relative-time-label", () => ({
  useRelativeTimeLabel: () => "刚刚",
}))

function record(partial: Partial<ProjectCompletion> & Pick<ProjectCompletion, "id">): ProjectCompletion {
  const { id, ...overrides } = partial
  return {
    id,
    userId: "owner-1",
    projectId: 392,
    explorationId: 11,
    author: "小明",
    completedAt: "刚刚",
    completedAtIso: `2026-08-10T14:${id}:00.000Z`,
    proofImages: [`https://example.com/${id}.webp`],
    notes: `第 ${id} 步`,
    isPublic: true,
    likes: 1,
    coins: 0,
    commentsCount: 1,
    status: "approved",
    recordKind: "progress",
    ...overrides,
  }
}

describe("ExplorationRecordGroupCard", () => {
  it("renders one representative image for a multi-step exploration", () => {
    const [group] = groupCompletionsByExploration([
      record({ id: 15 }),
      record({ id: 16 }),
      record({ id: 18, recordKind: "final" }),
    ])

    render(<ExplorationRecordGroupCard group={group} />)

    expect(screen.getByText("3 步探索")).toBeInTheDocument()
    expect(screen.getAllByRole("img")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "查看 小明 的完整探索详情" })).toHaveAttribute(
      "href",
      "/works/18",
    )
  })

  it("opens an unfinished exploration and lets its owner choose a final step", () => {
    const [group] = groupCompletionsByExploration([
      record({ id: 15 }),
      record({ id: 16 }),
    ])

    render(<ExplorationRecordGroupCard group={group} currentUserId="owner-1" />)

    expect(screen.getByRole("link", { name: "查看 小明 的完整探索详情" })).toHaveAttribute(
      "href",
      "/works/16",
    )
    expect(screen.getByRole("link", { name: /选它作为完成作品/ })).toHaveAttribute(
      "href",
      "/works/16#exploration-process",
    )
  })
})
