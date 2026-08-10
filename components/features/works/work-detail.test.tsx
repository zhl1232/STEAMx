import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Work } from "@/lib/mappers/types"

import { WorkDetail } from "./work-detail"

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  myTipped: 0,
  promptLogin: vi.fn(),
}))

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockShareWorkDialog() {
      return <div data-testid="share-work-dialog" />
    },
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: mocks.mutate,
    isPending: false,
  }),
  useQuery: (options: { queryKey?: unknown[] }) => {
    if (options.queryKey?.[0] === "tip_my") {
      return { data: mocks.myTipped }
    }

    return { data: { count: 3, isLiked: false } }
  },
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}))

vi.mock("@/components/features/project/completion-record-comments", () => ({
  CompletionRecordComments: () => <div />,
}))

vi.mock("@/components/features/project/tip-project-dialog", () => ({
  TipProjectDialog: () => null,
}))

vi.mock("@/components/ui/avatar-with-frame", () => ({
  AvatarWithFrame: () => <div />,
}))

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "viewer-1" } }),
}))

vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }),
}))

const work: Work = {
  id: 42,
  userId: "owner-1",
  projectId: 7,
  author: "小明",
  completedAt: "刚刚",
  proofImages: ["https://example.com/work.webp"],
  notes: "这是我的第一次结构搭建作品。",
  isPublic: true,
  likes: 3,
  coins: 1,
  status: "approved",
  recordKind: "final",
  source: {
    type: "project",
    id: 7,
    title: "会跑的小车",
    href: "/project/7",
  },
}

describe("WorkDetail sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.myTipped = 0
  })

  it("shows the share action for the work owner", () => {
    render(<WorkDetail work={work} canShare />)

    expect(screen.getByRole("button", { name: "分享作品" })).toBeInTheDocument()
  })

  it("hides the share action for other viewers", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.queryByRole("button", { name: "分享作品" })).not.toBeInTheDocument()
  })

  it("does not auto-open sharing for another viewer", () => {
    render(<WorkDetail work={work} canShare={false} autoOpenShare />)

    expect(screen.queryByTestId("share-work-dialog")).not.toBeInTheDocument()
  })

  it("auto-opens sharing for the work owner after submission", () => {
    render(<WorkDetail work={work} canShare autoOpenShare />)

    expect(screen.getByTestId("share-work-dialog")).toBeInTheDocument()
  })
})

describe("WorkDetail content and support actions", () => {
  it("presents the work as the shared place for messages and questions", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.getByRole("heading", { name: "留言与提问" })).toBeInTheDocument()
  })

  it("places only like and coin support actions alongside the author for other viewers", () => {
    const { container } = render(<WorkDetail work={{ ...work, commentsCount: 2 }} canShare={false} />)
    const media = screen.getByRole("region", { name: "作品媒体" })
    const info = screen.getByRole("complementary", { name: "作品信息" })
    const actions = within(info).getByRole("group", { name: "作品支持操作" })

    expect(within(actions).getByRole("button", { name: "点赞，当前 3 个赞" })).toBeInTheDocument()
    expect(within(actions).getByRole("button", { name: "投币支持，当前 1 枚" })).toBeInTheDocument()
    expect(within(actions).queryAllByRole("button")).toHaveLength(2)
    expect(within(media).queryByRole("group", { name: "作品支持操作" })).not.toBeInTheDocument()
    expect(container.querySelector('a[href="#comments"]')).not.toBeInTheDocument()
  })

  it("marks coin support as already tipped when the viewer has tipped this work", () => {
    mocks.myTipped = 1

    render(<WorkDetail work={work} canShare={false} />)
    const info = screen.getByRole("complementary", { name: "作品信息" })
    const actions = within(info).getByRole("group", { name: "作品支持操作" })
    const coinButton = within(actions).getByRole("button", {
      name: "已投币支持，当前 1 枚，我已投 1 枚",
    })

    expect(coinButton.className).toContain("text-[hsl(var(--brand-amber))]")
    expect(coinButton.className).not.toContain("bg-[hsl(var(--brand-amber)")
    expect(coinButton.className).not.toContain("border-[hsl(var(--brand-amber)")
  })

  it("hides the entire creation notes section when notes are blank", () => {
    render(<WorkDetail work={{ ...work, notes: " \n " }} canShare={false} />)

    expect(screen.queryByRole("heading", { name: "创作记录" })).not.toBeInTheDocument()
    expect(screen.queryByText("作者还没有补充创作说明。")).not.toBeInTheDocument()
  })

  it("shows creation notes when the author provided them", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.getByRole("heading", { name: "创作记录" })).toBeInTheDocument()
    expect(screen.getByText(work.notes!)).toBeInTheDocument()
  })
})
