import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TextbookFrame from "./textbook-frame"

vi.mock("next/dynamic", () => ({ default: () => (props: { onUseLegacy: () => void }) => <button onClick={props.onUseLegacy}>植物试点</button> }))

describe("native lesson routing", () => {
  beforeEach(() => { vi.stubGlobal("IntersectionObserver", undefined) })
  afterEach(() => { vi.unstubAllGlobals() })
  it.each(["p1a-1-1", "p1a-1-2"])("uses native %s with one renderer on either fallback path", (lessonId) => {
    const { rerender } = render(<TextbookFrame lessonId={lessonId} src="about:blank" title="课本" />)
    expect(document.querySelectorAll("iframe")).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: "植物试点" }))
    expect(document.querySelectorAll("iframe")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "返回新版植物课本" }))
    expect(document.querySelectorAll("iframe")).toHaveLength(0)
    rerender(<TextbookFrame lessonId="p1a-1-3" src="about:blank" title="下一课" />)
    expect(screen.getByTitle("下一课")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "植物试点" })).toBeNull()
  })
})
