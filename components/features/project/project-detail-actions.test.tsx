import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: 0 }) }))
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }),
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/hooks/use-sync-project-interactions", () => ({ useSyncProjectInteractions: () => {} }))
vi.mock("@/components/features/project/tip-project-dialog", () => ({ TipProjectDialog: () => null }))
vi.mock("@/components/ui/report-dialog", () => ({ ReportDialog: () => null }))
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
    fireEvent.click(screen.getByRole("button", { name: "登录记录我的项目" }))

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
