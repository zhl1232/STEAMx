import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Work } from "@/lib/mappers/types"
import type { WorkJourneyRecord } from "@/lib/works/types"

import { WorkDetail } from "./work-detail"

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  myTipped: 0,
  promptLogin: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
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
  it("names the actual destination for project work navigation", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.getByRole("link", { name: "返回探索记录" })).toHaveAttribute(
      "href",
      "/project/7",
    )
    expect(screen.queryByRole("link", { name: "返回来源" })).not.toBeInTheDocument()
  })

  it("uses a page-owned mobile title bar for the detail view", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.getByRole("button", { name: "返回探索记录" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "会跑的小车" })).toBeInTheDocument()
    expect(screen.getByText("已完成探索")).toBeInTheDocument()
  })

  it("uses course lesson wording for course work navigation", () => {
    render(
      <WorkDetail
        work={{
          ...work,
          projectId: null,
          courseLessonId: 70,
          source: {
            type: "course_lesson",
            id: 70,
            title: "轮船",
            href: "/courses/5/lessons/70?view=works",
            image: "/courses/ship.webp",
            courseId: 5,
            courseTitle: "小班大颗粒积木",
          },
        }}
        canShare={false}
      />,
    )

    expect(screen.getByRole("link", { name: "返回课程课时" })).toHaveAttribute(
      "href",
      "/courses/5/lessons/70?view=works",
    )
  })

  it("falls back to the exploration entry when no source is available", () => {
    render(<WorkDetail work={{ ...work, source: undefined }} canShare={false} />)

    expect(screen.getByRole("link", { name: "返回探索" })).toHaveAttribute("href", "/explore")
  })

  it("presents the work as the shared place for messages and questions", () => {
    render(<WorkDetail work={work} canShare={false} />)

    expect(screen.getByRole("heading", { name: "留言与提问" })).toBeInTheDocument()
  })

  it("makes the exploration timeline primary when a work has a journey", () => {
    const journey: WorkJourneyRecord[] = [
      {
        id: 15,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:54:37.000Z",
        proofImages: ["https://example.com/observe.webp"],
        recordKind: "progress",
        recordType: "observation",
      },
      {
        id: 18,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:56:45.000Z",
        proofImages: ["https://example.com/final.webp"],
        recordKind: "final",
      },
    ]

    render(
      <WorkDetail
        work={{ ...work, id: 18 }}
        journeyRecords={journey}
        canShare={false}
      />,
    )

    const timeline = screen.getByRole("region", { name: "探索过程" })
    const info = screen.getByRole("complementary", { name: "作品信息" })

    expect(screen.queryByRole("region", { name: "作品媒体" })).not.toBeInTheDocument()
    expect(timeline.compareDocumentPosition(info) & 4).toBe(4)
    expect(within(timeline).getByText("最终作品")).toBeInTheDocument()
    expect(screen.getByText("查看探索记录 →")).toBeInTheDocument()
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

  it("shows every exploration record in chronological order before the final work", () => {
    const journey: WorkJourneyRecord[] = [
      {
        id: 18,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:56:45.000Z",
        proofImages: ["https://example.com/final.webp"],
        notes: "完成迷宫",
        recordKind: "final",
      },
      {
        id: 15,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:54:37.000Z",
        proofImages: ["https://example.com/observe.webp"],
        recordKind: "progress",
        recordType: "observation",
      },
      {
        id: 17,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:55:57.000Z",
        proofImages: ["https://example.com/insight.webp"],
        notes: "找到更短的路线",
        recordKind: "progress",
        recordType: "insight",
      },
    ]

    render(
      <WorkDetail
        work={{ ...work, id: 18 }}
        journeyRecords={journey}
        journeyTotal={51}
        journeyHasMore
        canShare={false}
      />,
    )

    const timeline = screen.getByRole("region", { name: "探索过程" })
    const records = within(timeline).getAllByRole("listitem")

    expect(records).toHaveLength(3)
    expect(records[0]).toHaveTextContent("观察记录")
    expect(records[1]).toHaveTextContent("心得分享")
    expect(records[2]).toHaveTextContent("最终作品")
    expect(records[2]).toHaveTextContent("当前作品")
    expect(screen.getByText("最近记录（部分展示）")).toBeInTheDocument()
    expect(screen.getByText("最近 3 / 51 条记录")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "创作记录" })).not.toBeInTheDocument()
  })

  it("shows unfinished exploration details and lets the owner promote any approved step", () => {
    const journey: WorkJourneyRecord[] = [
      {
        id: 15,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:54:37.000Z",
        proofImages: ["https://example.com/observe.webp"],
        recordKind: "progress",
        recordType: "observation",
      },
      {
        id: 16,
        completedAt: "2026/8/10",
        completedAtIso: "2026-08-10T14:55:37.000Z",
        proofImages: ["https://example.com/result.webp"],
        recordKind: "progress",
        recordType: "result",
      },
    ]

    render(
      <WorkDetail
        work={{ ...work, id: 16, recordKind: "progress" }}
        journeyRecords={journey}
        canShare={false}
        canPromote
      />,
    )

    expect(screen.getByText("这次探索还没有完成作品")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "探索过程" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /把这一步设为完成作品/ })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "分享作品" })).not.toBeInTheDocument()
  })
})
