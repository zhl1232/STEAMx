import type { ReactNode } from "react"

import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CompletionRecordComments } from "./completion-record-comments"

const mocks = vi.hoisted(() => ({
  comments: [] as Array<Record<string, unknown>>,
  viewerId: "viewer-1" as string | null,
  reportDialog: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({ data: mocks.comments, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.viewerId ? { id: mocks.viewerId } : null,
  }),
}))

vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({
    promptLogin: vi.fn(),
    runAfterAgeConfirmation: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/components/ui/report-dialog", () => ({
  ReportDialog: ({
    children,
    contentId,
    contentType,
  }: {
    children: ReactNode
    contentId: number | string
    contentType: string
  }) => {
    mocks.reportDialog({ contentId, contentType })
    return <>{children}</>
  },
}))

describe("CompletionRecordComments reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.viewerId = "viewer-1"
    mocks.comments = []
  })

  it("lets a signed-in viewer report another user's work comment", () => {
    mocks.comments = [
      {
        id: 17,
        author: "小明",
        userId: "author-1",
        content: "这个结构是怎么固定的？",
        date: "刚刚",
        parent_id: null,
      },
    ]

    render(<CompletionRecordComments completionId={42} />)

    expect(screen.getByRole("button", { name: "举报 小明 的评论" })).toBeInTheDocument()
    expect(mocks.reportDialog).toHaveBeenCalledWith({
      contentId: 17,
      contentType: "completion_comment",
    })
  })

  it("does not show a report action on the viewer's own comment", () => {
    mocks.comments = [
      {
        id: 18,
        author: "我",
        userId: "viewer-1",
        content: "补充一下制作过程。",
        date: "刚刚",
        parent_id: null,
      },
    ]

    render(<CompletionRecordComments completionId={42} />)

    expect(screen.queryByRole("button", { name: /举报/ })).not.toBeInTheDocument()
    expect(mocks.reportDialog).not.toHaveBeenCalled()
  })
})
