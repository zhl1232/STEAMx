import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LegacyTextbookFrame as TextbookFrame, clampTextbookHeight } from "./textbook-frame"

function post(frame: HTMLIFrameElement, data: unknown, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: frame.contentWindow }))
  })
}

describe("TextbookFrame", () => {
  // 默认按“没有 IntersectionObserver”处理，直接挂 iframe
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", undefined)
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null })
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, "fullscreenElement")
    Reflect.deleteProperty(document, "exitFullscreen")
  })

  it("不可见时不创建 iframe（避免同一页面开两个 WebGL）", () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} })
    render(<TextbookFrame lessonId="g8a-1-1" src="about:blank" title="隐藏的课本" />)
    expect(screen.queryByTitle("隐藏的课本")).toBeNull()
  })

  it("限制高度范围", () => {
    expect(clampTextbookHeight(100)).toBe(420)
    expect(clampTextbookHeight(99999)).toBe(1400)
    expect(clampTextbookHeight("800")).toBeNull()
  })

  it("只接受同源、本课的消息，并在完成时回调一次", () => {
    const onComplete = vi.fn()
    render(<TextbookFrame lessonId="g8a-1-1" src="about:blank" title="课本" onComplete={onComplete} />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    post(frame, { type: "steamx-textbook-height", version: 1, lesson: "g8a-1-1", height: 900 }, "https://evil.example")
    expect(frame.style.height).toBe("640px")
    post(frame, { type: "steamx-textbook-height", version: 1, lesson: "g8a-1-2", height: 900 })
    expect(frame.style.height).toBe("640px")
    post(frame, { type: "steamx-textbook-height", version: 1, lesson: "g8a-1-1", height: 900 })
    expect(frame.style.height).toBe("900px")
    post(frame, { type: "steamx-textbook-progress", version: 1, lesson: "g8a-1-1", page: 1, pages: 4 })
    expect(screen.getByText("第 2 / 4 页")).toBeInTheDocument()
    post(frame, { type: "steamx-textbook-complete", version: 1, lesson: "g8a-1-1" })
    post(frame, { type: "steamx-textbook-complete", version: 1, lesson: "g8a-1-1" })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByText("挑战完成")).toBeInTheDocument()
  })

  it("不接收其他 iframe 的消息或越界页码", () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    post(frame, { type: "steamx-textbook-progress", version: 1, lesson: "p1a-1-1", page: 2, pages: 2 })
    expect(screen.queryByText("第 3 / 2 页")).toBeNull()
    act(() => window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      source: window,
      data: { type: "steamx-textbook-complete", version: 1, lesson: "p1a-1-1" },
    })))
    expect(screen.queryByText("已探索")).toBeNull()
  })

  it("全屏反复进入退出保留同一课本，恢复页面滚动与焦点", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    vi.spyOn(window, "scrollY", "get").mockReturnValue(238)
    render(<><button type="button">课本目录</button><TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" /></>)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    post(frame, { type: "steamx-textbook-progress", version: 1, lesson: "p1a-1-1", page: 1, pages: 2 })
    document.body.style.overflow = "auto"
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
      expect(screen.getByRole("button", { name: "退出全屏", pressed: true })).toHaveFocus()
      expect(document.body.style.overflow).toBe("hidden")
      expect(screen.getByText("课本目录")).toHaveAttribute("inert")
      expect(frame.style.height).toBe("")
      fireEvent.click(screen.getByRole("button", { name: "退出全屏" }))
      expect(document.body.style.overflow).toBe("auto")
      expect(screen.getByText("课本目录")).not.toHaveAttribute("inert")
      expect(screen.getByTitle("课本")).toBe(frame)
      expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "全屏阅读" })).toHaveFocus()
    }
    expect(scrollTo).toHaveBeenCalledWith({ top: 238, left: 0, behavior: "instant" })
    document.body.style.overflow = ""
  })

  it("原生全屏被拒绝时仍保留页面内全屏，Escape 可退出", async () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const container = screen.getByRole("button", { name: "全屏阅读" }).parentElement!.parentElement!
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("Not allowed"))
    Object.defineProperty(container, "requestFullscreen", { configurable: true, value: requestFullscreen })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "全屏阅读" })) })
    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "退出全屏" })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeInTheDocument()
  })

  it("课本内获得焦点时 Escape 同样退出全屏", () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    fireEvent.load(frame)
    fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
    act(() => frame.contentWindow!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeInTheDocument()
  })

  it("浏览器结束原生全屏时清理页面内全屏", () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const container = screen.getByRole("button", { name: "全屏阅读" }).parentElement!.parentElement!
    const nativeElement = vi.spyOn(document, "fullscreenElement", "get")
    fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
    nativeElement.mockReturnValue(container)
    fireEvent(document, new Event("fullscreenchange"))
    nativeElement.mockReturnValue(null)
    fireEvent(document, new Event("fullscreenchange"))
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe("hidden")
  })

  it("退出后才成功的原生全屏请求会被关闭", async () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const container = screen.getByRole("button", { name: "全屏阅读" }).parentElement!.parentElement!
    let resolve!: () => void
    Object.defineProperty(container, "requestFullscreen", { configurable: true, value: () => new Promise<void>((done) => { resolve = done }) })
    const nativeElement = vi.spyOn(document, "fullscreenElement", "get")
    const exit = vi.spyOn(document, "exitFullscreen").mockResolvedValue()
    fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
    fireEvent.click(screen.getByRole("button", { name: "退出全屏" }))
    await act(async () => { nativeElement.mockReturnValue(container); resolve() })
    expect(exit).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeInTheDocument()
  })

  it("切课清理全屏并重置页数与完成状态", () => {
    const onComplete = vi.fn()
    const { rerender } = render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" onComplete={onComplete} />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    post(frame, { type: "steamx-textbook-progress", version: 1, lesson: "p1a-1-1", page: 1, pages: 2 })
    post(frame, { type: "steamx-textbook-complete", version: 1, lesson: "p1a-1-1" })
    expect(screen.getByText("已探索")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
    rerender(<TextbookFrame lessonId="p1a-1-2" src="about:blank" title="课本" onComplete={onComplete} />)
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe("hidden")
    expect(screen.queryByText("第 2 / 2 页")).toBeNull()
    expect(screen.queryByText("已探索")).toBeNull()
    post(screen.getByTitle("课本") as HTMLIFrameElement, { type: "steamx-textbook-complete", version: 1, lesson: "p1a-1-2" })
    expect(onComplete).toHaveBeenCalledTimes(2)
  })

  it("只报告高度不代表加载完成，超时后提供重试", () => {
    vi.useFakeTimers()
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    post(frame, { type: "steamx-textbook-height", version: 1, lesson: "p1a-1-1", height: 700 })
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByRole("alert")).toHaveTextContent("课本加载时间有点长")
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }))
    expect(screen.getByTitle("课本")).not.toBe(frame)
    expect(screen.queryByRole("alert")).toBeNull()
    post(screen.getByTitle("课本") as HTMLIFrameElement, { type: "steamx-textbook-ready", version: 1, lesson: "p1a-1-1" })
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("WebGL 不可用时显示可恢复的错误提示", async () => {
    render(<TextbookFrame lessonId="p1a-1-1" src="about:blank" title="课本" />)
    const frame = screen.getByTitle("课本") as HTMLIFrameElement
    fireEvent.load(frame)
    frame.contentDocument!.body.classList.add("nogl")
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("暂时无法显示 3D 画面"))
    post(frame, { type: "steamx-textbook-ready", version: 1, lesson: "p1a-1-1" })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }))
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
