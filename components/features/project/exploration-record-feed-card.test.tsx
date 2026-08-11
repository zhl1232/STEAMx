import type { ReactNode } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectCompletion } from "@/lib/mappers/types"

import { ExplorationRecordFeedCard } from "./exploration-record-feed-card"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn() }),
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: () => <span role="img" aria-label="作品图片" />,
}))

vi.mock("@/components/features/project/completion-record-comments", () => ({
  CompletionRecordComments: () => null,
  CompletionRecordCommentsPreview: () => null,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock("@/hooks/use-relative-time-label", () => ({
  useRelativeTimeLabel: () => "刚刚",
}))

const completion: ProjectCompletion = {
  id: 6,
  userId: "author-1",
  projectId: 392,
  author: "小明",
  completedAt: "刚刚",
  proofImages: [],
  notes: "完成了最终作品。",
  isPublic: true,
  likes: 2,
  coins: 0,
  status: "approved",
  recordKind: "final",
}

describe("ExplorationRecordFeedCard work navigation", () => {
  it("links a final record to its work detail page", () => {
    render(
      <ExplorationRecordFeedCard
        completion={completion}
        initialLikeMeta={{ count: 2, isLiked: false }}
      />,
    )

    expect(screen.getByRole("link", { name: "查看 小明 的作品详情" })).toHaveAttribute(
      "href",
      "/works/6",
    )
  })

  it("does not show a work detail link for a progress record", () => {
    render(
      <ExplorationRecordFeedCard
        completion={{ ...completion, id: 7, recordKind: "progress" }}
        initialLikeMeta={{ count: 2, isLiked: false }}
      />,
    )

    expect(screen.queryByRole("link", { name: /作品详情/ })).not.toBeInTheDocument()
  })
})
