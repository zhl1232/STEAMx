import type { Window as HappyWindow } from "happy-dom"
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/explore-data", () => ({
  getProjectById: vi.fn(),
  getProjectCompletions: vi.fn().mockResolvedValue([]),
  getProjectCompletionsCount: vi.fn().mockResolvedValue(0),
  getProjectCollectionsCount: vi.fn().mockResolvedValue(0),
  getProjectTotalCoinsReceived: vi.fn().mockResolvedValue(0),
  getRelatedProjects: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock("@/lib/store/service", () => ({ listStoreProductsForContext: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/kits/service", () => ({ getProjectKitMatches: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/api/courses", () => ({ getCourseLessonByWorksProjectId: vi.fn().mockResolvedValue(null) }))
vi.mock("next/dynamic", async () => {
  const { default: PlantLesson } = await import("@/components/features/textbook3d/native/plant-lesson")
  return { default: () => PlantLesson }
})
vi.mock("@/components/features/textbook3d/native/plant-canvas", () => ({ PlantCanvas: ({ onTurningChange }: { onTurningChange?: (value: boolean) => void }) => <div aria-label="植物画布"><button type="button" onClick={() => onTurningChange?.(true)}>模拟翻页中</button></div> }))

import ProjectDetailPage from "./page"
import TextbookFrame from "@/components/features/textbook3d/textbook-frame"
import { getProjectById } from "@/lib/api/explore-data"

// Keep the actual server page's reader branches and every DOM ancestor/class.
// Omit unrelated project widgets (auth, commerce, etc.), not the two readers or
// their shared hook. This guards the real dual-layout integration, not a demo.
function readerBranches(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.flatMap((child) => readerBranches(child)).filter(Boolean)
    .map((child, key) => isValidElement(child) ? cloneElement(child, { key }) : child)
  if (!isValidElement<Record<string, unknown>>(node)) return null
  if (node.type === TextbookFrame) return cloneElement(node, { src: "about:blank" }) // iframe network boundary
  const children = readerBranches(node.props.children as ReactNode)
  if (!children || (Array.isArray(children) && children.length === 0)) return null
  if (typeof node.type === "string") return cloneElement(node, undefined, children)
  return <div key={node.key} id={node.props.id as string | undefined}>{children}</div>
}

function viewport(width: number, height: number) {
  // happy-dom evaluates CSS media queries but has no layout/WebGL engine.
  (window as unknown as HappyWindow).happyDOM.setViewport({ width, height })
  // happy-dom caches computed media styles across viewport changes. Force the
  // stylesheet invalidation a real browser performs before its resize event.
  const stylesheet = document.getElementById("project-responsive-test-css")
  if (stylesheet) stylesheet.textContent += " "
  window.dispatchEvent(new Event("resize"))
}

async function projectReaders(lessonId = "p1a-1-1") {
  vi.mocked(getProjectById).mockResolvedValue({
    id: 42, title: "植物观察", category: "科学", author: "", author_id: "", image: "", likes: 0,
    status: "approved", moderation_state: "approved", textbook3dLessonId: lessonId,
  })
  const output = await ProjectDetailPage({ params: Promise.resolve({ id: "42" }) })
  const view = render(readerBranches(output) as ReactElement)
  const mobile = document.getElementById("project-textbook-mobile")!
  const desktop = document.getElementById("project-textbook")!
  expect(mobile).not.toBeNull()
  expect(desktop).not.toBeNull()
  expect(mobile.closest(".md\\:hidden")).not.toBeNull()
  expect(desktop.closest(".md\\:block")).toHaveClass("hidden")
  return { ...view, mobile, desktop }
}

const enter = (branch: HTMLElement) => fireEvent.click(within(branch).getByRole("button", { name: "全屏阅读" }))
const leave = (branch: HTMLElement) => fireEvent.click(within(branch).getByRole("button", { name: "退出全屏" }))
function expectUnlocked() {
  expect(document.body.style.overflow).toBe("auto")
  expect(document.documentElement.style.overflow).toBe("scroll")
  expect(document.querySelectorAll("[inert]")).toHaveLength(0)
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined)
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  vi.spyOn(window, "scrollY", "get").mockReturnValue(238)
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null })
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  document.body.style.overflow = "auto"
  document.documentElement.style.overflow = "scroll"
  const style = document.createElement("style")
  style.id = "project-responsive-test-css"
  style.textContent = ".hidden{display:none}@media (min-width: 768px){.md\\:hidden{display:none}.md\\:block{display:block}}"
  document.head.append(style)
  viewport(390, 844)
})
afterEach(() => {
  cleanup()
  document.getElementById("project-responsive-test-css")?.remove()
  document.body.style.overflow = ""
  document.documentElement.style.overflow = ""
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, "fullscreenElement")
  Reflect.deleteProperty(document, "exitFullscreen")
})

describe("project textbook dual-layout fullscreen", () => {
  it.each(["p1a-1-1", "p1a-1-2"])("%s releases hidden fallback sessions through portrait/landscape round trips", async (lessonId) => {
    const { mobile, desktop, unmount } = await projectReaders(lessonId)
    expect(mobile).toBeVisible()
    expect(desktop).not.toBeVisible()
    for (let cycle = 0; cycle < 3; cycle++) {
      enter(mobile)
      expect(document.body.style.overflow).toBe("hidden")
      expect(desktop.closest("[inert]")).not.toBeNull()
      act(() => viewport(844, 390))
      expect(mobile).not.toBeVisible()
      expect(desktop).toBeVisible()
      expectUnlocked()
      expect(mobile.contains(document.activeElement)).toBe(false)
      enter(desktop)
      expect(document.body.style.overflow).toBe("hidden")
      act(() => viewport(390, 844))
      expectUnlocked()
      expect(desktop.contains(document.activeElement)).toBe(false)
      enter(mobile)
      leave(mobile)
      expectUnlocked()
      expect(within(mobile).getByRole("button", { name: "全屏阅读" })).toHaveFocus()
    }
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 238, left: 0, behavior: "instant" })
    enter(mobile)
    unmount()
    expectUnlocked()
  })

  it("exits a rejected native request's fallback when an ancestor is hidden without resizing", async () => {
    const { mobile, desktop } = await projectReaders()
    const box = within(mobile).getByRole("button", { name: "全屏阅读" }).closest("[data-textbook-reader]")
      ?? within(mobile).getByRole("button", { name: "全屏阅读" }).parentElement!.parentElement!
    const request = vi.fn().mockRejectedValue(new Error("Unsupported"))
    Object.defineProperty(box, "requestFullscreen", { configurable: true, value: request })
    await act(async () => enter(mobile))
    expect(request).toHaveBeenCalledOnce()
    await act(async () => { mobile.closest<HTMLElement>(".md\\:hidden")!.style.display = "none" })
    expectUnlocked()
    expect(desktop.closest("[inert]")).toBeNull()
  })

  it("keeps one lock owner during competing entry and synchronous layout handover", async () => {
    const { mobile, desktop } = await projectReaders()
    const desktopLayout = desktop.closest<HTMLElement>(".md\\:block")!
    desktopLayout.style.display = "block"
    // Both can be present during layout transitions; even synthetic competing
    // requests must not stack snapshots that restore body overflow to hidden.
    const desktopEnter = within(desktop).getByRole("button", { name: "全屏阅读" })
    act(() => { enter(mobile); fireEvent.click(desktopEnter) })
    expect(screen.getAllByRole("button", { name: "退出全屏" })).toHaveLength(1)
    expect(within(mobile).getByRole("button", { name: "退出全屏" })).toBeInTheDocument()
    // Enter the replacement before resize/mutation observers get a callback.
    await act(async () => {
      mobile.closest<HTMLElement>(".md\\:hidden")!.style.display = "none"
      fireEvent.click(desktopEnter)
    })
    expect(within(desktop).getByRole("button", { name: "退出全屏" })).toHaveFocus()
    expect(desktop.closest("[inert]")).toBeNull()
    expect(document.body.style.overflow).toBe("hidden")
    leave(desktop)
    expectUnlocked()
    enter(desktop)
    leave(desktop)
    expectUnlocked()
  })

  it("releases the hidden mobile fullscreen owner even while its page-turn UI is busy", async () => {
    const { mobile, desktop } = await projectReaders()
    enter(mobile)
    fireEvent.click(within(mobile).getByRole("button", { name: "下一页" }))
    fireEvent.click(within(mobile).getByRole("button", { name: "模拟翻页中" }))
    expect(within(mobile).getByRole("button", { name: "上一页" })).toBeDisabled()
    expect(within(mobile).getByRole("button", { name: "退出全屏" })).toBeEnabled()
    act(() => viewport(844, 390))
    expectUnlocked()
    enter(desktop)
    leave(desktop)
    expectUnlocked()
    act(() => viewport(390, 844))
    expectUnlocked()
  })

})
