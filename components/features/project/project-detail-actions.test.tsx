import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectDetailActions } from "./project-detail-actions"

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  exploring: false,
  completed: false,
  push: vi.fn(),
  promptLogin: vi.fn(),
  startExploration: vi.fn(),
  toast: vi.fn(),
  myTipped: 0,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mocks.myTipped }) }))
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }),
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/hooks/use-sync-project-interactions", () => ({ useSyncProjectInteractions: () => {} }))
vi.mock("@/components/features/project/tip-project-dialog", () => ({ TipProjectDialog: () => null }))
vi.mock("@/lib/context/project-context", () => ({
  useProjects: () => ({
    isCollected: () => false,
    isLiked: () => false,
    getLikesDelta: () => 0,
    getCollectionsDelta: () => 0,
    clearLikesDelta: vi.fn(),
    toggleCollection: vi.fn(),
    toggleLike: vi.fn(),
    isCompleted: () => mocks.completed,
    isExploring: () => mocks.exploring,
    startExploration: mocks.startExploration,
  }),
}))

function renderEntry() {
  return render(<ProjectDetailActions projectId={7} projectTitle="纸桥" variant="hero" />)
}

describe("desktop project entry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = null
    mocks.exploring = false
    mocks.completed = false
    mocks.myTipped = 0
    mocks.startExploration.mockResolvedValue(undefined)
  })

  it("lets a guest browse materials and steps without signing in or starting a record", () => {
    renderEntry()

    const browse = screen.getByRole("link", { name: "查看材料与步骤" })
    expect(browse).toHaveAttribute("href", "#project-materials")
    fireEvent.click(browse)

    expect(mocks.promptLogin).not.toHaveBeenCalled()
    expect(mocks.startExploration).not.toHaveBeenCalled()
    expect(screen.getByText(/查看材料与步骤无需登录/)).toBeInTheDocument()
  })

  it("keeps record creation behind login and resumes the original action afterwards", async () => {
    renderEntry()
    fireEvent.click(screen.getByRole("button", { name: "登录记录项目" }))

    expect(mocks.startExploration).not.toHaveBeenCalled()
    expect(mocks.promptLogin).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      description: "登录后即可记录探索过程并上传作品",
    }))
    mocks.promptLogin.mock.calls[0][0]()
    await waitFor(() => expect(mocks.startExploration).toHaveBeenCalledWith(7))
  })

  it.each(["project-steps", "project-steps-mobile"])(
    "scrolls only to the visible responsive steps section (%s) when starting",
    async (visibleId) => {
      mocks.user = { id: "user-1" }
      render(
        <>
          <div id="project-steps-mobile" />
          <div id="project-steps" />
          <ProjectDetailActions projectId={7} projectTitle="纸桥" variant="hero" />
        </>,
      )
      const targets = ["project-steps-mobile", "project-steps"].map((id) => {
        const element = document.getElementById(id)!
        const scroll = vi.fn()
        Object.defineProperty(element, "getClientRects", { value: () => id === visibleId ? [{}] : [] })
        Object.defineProperty(element, "scrollIntoView", { value: scroll })
        return { id, scroll }
      })

      fireEvent.click(screen.getByRole("button", { name: "开始我的项目" }))

      await waitFor(() => expect(targets.find(({ id }) => id === visibleId)!.scroll)
        .toHaveBeenCalledWith({ behavior: "smooth", block: "start" }))
      expect(targets.find(({ id }) => id !== visibleId)!.scroll).not.toHaveBeenCalled()
      expect(mocks.startExploration).toHaveBeenCalledOnce()
    },
  )

  it.each([
    { exploring: true, completed: false, label: "继续我的项目" },
    { exploring: false, completed: true, label: "开始新的尝试" },
  ])("preserves the records destination for $label", ({ exploring, completed, label }) => {
    mocks.user = { id: "user-1" }
    mocks.exploring = exploring
    mocks.completed = completed
    renderEntry()

    fireEvent.click(screen.getByRole("button", { name: label }))

    expect(mocks.push).toHaveBeenCalledWith("/project/7/records")
    expect(mocks.startExploration).not.toHaveBeenCalled()
    expect(mocks.promptLogin).not.toHaveBeenCalled()
  })
})

describe("mobile project actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: "user-1" }
    mocks.myTipped = 0
  })

  it("shows the visible like and total coin counts with the untipped label", () => {
    render(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="support"
        likes={12}
        projectOwnerId="owner-1"
        projectCoinsReceived={8}
      />,
    )

    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "投币支持，累计收到 8 枚硬币" })).toBeInTheDocument()
  })

  it("shows the zero total and prompts a guest before tipping", () => {
    mocks.user = null
    render(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="support"
        projectOwnerId="owner-1"
      />,
    )

    const tipButton = screen.getByRole("button", { name: "投币支持，累计收到 0 枚硬币" })
    expect(tipButton).toHaveTextContent("0")
    fireEvent.click(tipButton)
    expect(mocks.promptLogin).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      title: "投币支持项目",
    }))
  })

  it("shows the current tipped amount and keeps an own project's coin total read-only", () => {
    mocks.myTipped = 2
    const { rerender } = render(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="support"
        projectOwnerId="owner-1"
        projectCoinsReceived={9}
      />,
    )
    expect(screen.getByRole("button", { name: "已投币支持，累计收到 9 枚硬币" })).toBeInTheDocument()

    rerender(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="support"
        projectOwnerId="user-1"
        projectCoinsReceived={9}
      />,
    )
    expect(screen.getByLabelText("收到 9 枚硬币")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /投币/ })).not.toBeInTheDocument()
  })

  it("opens report from the more menu while keeping the dialog outside the menu", async () => {
    const user = userEvent.setup()
    render(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="cover"
        projectOwnerId="owner-1"
      />,
    )

    await user.click(screen.getByRole("button", { name: "更多操作" }))
    await user.click(await screen.findByRole("menuitem", { name: "举报项目" }))
    const dialog = await screen.findByRole("dialog", { name: "举报内容" })
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole("button", { name: "更多操作" })).toHaveFocus())
  })

  it("does not render an empty more menu for the project owner", () => {
    render(
      <ProjectDetailActions
        projectId={7}
        projectTitle="纸桥"
        variant="cover"
        projectOwnerId="user-1"
      />,
    )

    expect(screen.getByRole("button", { name: "分享项目" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "更多操作" })).not.toBeInTheDocument()
  })
})
