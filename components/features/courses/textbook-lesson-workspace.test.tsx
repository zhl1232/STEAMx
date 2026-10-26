import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CourseLessonRow } from "@/lib/courses/types"

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
const promptLogin = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => auth }))
vi.mock("@/lib/context/login-prompt-context", () => ({ useLoginPrompt: () => ({ promptLogin }) }))
vi.mock("@/lib/textbook3d/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/textbook3d/registry")>()),
  textbook3dSrc: () => "about:blank",
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

import { TextbookLessonWorkspace } from "./textbook-lesson-workspace"

const lesson = (textbookId?: string) =>
  ({ id: 7, title: "温度", lesson_type: "textbook_3d", content: textbookId ? { textbook3d: { lessonId: textbookId } } : {} }) as unknown as CourseLessonRow

function complete() {
  const frame = screen.getByTitle("3D 课本：温度") as HTMLIFrameElement
  act(() => {
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "steamx-textbook-complete", version: 1, lesson: "g8a-3-1" },
      origin: window.location.origin,
      source: frame.contentWindow,
    }))
  })
}

describe("TextbookLessonWorkspace", () => {
  beforeEach(() => {
    auth.user = null
    promptLogin.mockReset()
    toast.mockReset()
    vi.restoreAllMocks()
    // 立即报告可见，让课本 iframe 挂上（next/link 也要用到 IntersectionObserver）
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() { this.cb([{ isIntersecting: true }]) }
      unobserve() {}
      disconnect() {}
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it("课号没登记时给出说明，不嵌入任意地址", () => {
    render(<TextbookLessonWorkspace courseId={3} lesson={lesson("../../etc")} />)
    expect(screen.getByText("这节课还没有配置 3D 课本内容，请联系老师。")).toBeInTheDocument()
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("未登录完成挑战时提示登录，不调用完成接口", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    render(<TextbookLessonWorkspace courseId={3} lesson={lesson("g8a-3-1")} />)
    complete()
    expect(promptLogin).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("登录后完成挑战走现有完成接口并回调", async () => {
    auth.user = { id: "u1" }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ alreadyCompleted: false }), { status: 200 }))
    const onCompleted = vi.fn()
    render(<TextbookLessonWorkspace courseId={3} lesson={lesson("g8a-3-1")} onCompleted={onCompleted} />)
    complete()
    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledWith("/api/courses/3/lessons/7/complete", { method: "POST" })
    expect(screen.getByText("本课已完成，可以继续复习。")).toBeInTheDocument()
  })
})
