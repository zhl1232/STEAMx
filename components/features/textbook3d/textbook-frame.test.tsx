import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import TextbookFrame, { clampTextbookHeight } from "./textbook-frame"

function post(frame: HTMLIFrameElement, data: unknown, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: frame.contentWindow }))
  })
}

describe("TextbookFrame", () => {
  // 默认按“没有 IntersectionObserver”处理，直接挂 iframe
  beforeEach(() => { vi.stubGlobal("IntersectionObserver", undefined) })
  afterEach(() => { vi.unstubAllGlobals() })

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
})
