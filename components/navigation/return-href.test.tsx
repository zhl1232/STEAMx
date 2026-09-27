import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
const back = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back }) }))

import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { ReturnHrefTracker, ReturnLink } from "./return-href"
import { readReturnHrefRaw, rememberReturnHref } from "@/lib/navigation/return-href"

describe("ReturnHrefTracker / ReturnLink", () => {
  beforeEach(() => {
    sessionStorage.clear()
    push.mockReset()
    back.mockReset()
    window.history.replaceState(null, "", "/")
  })
  afterEach(() => window.history.replaceState(null, "", "/"))

  it("records the current page when clicking into a tracked nature page", () => {
    window.history.replaceState(null, "", "/nature?tab=map")
    render(
      <>
        <ReturnHrefTracker />
        <a href="/nature/observations/42" onClick={(event) => event.preventDefault()}>观察 42</a>
        <a href="/project/1" onClick={(event) => event.preventDefault()}>项目</a>
      </>,
    )
    fireEvent.click(screen.getByText("项目"))
    expect(readReturnHrefRaw()).toBeNull()
    fireEvent.click(screen.getByText("观察 42"))
    expect(JSON.parse(readReturnHrefRaw() ?? "[]")).toEqual([{ path: "/nature/observations/42", from: "/nature?tab=map" }])
  })

  it("ReturnLink uses the remembered page, else the fallback", () => {
    rememberReturnHref("/nature/observations/42", "/")
    window.history.replaceState(null, "", "/nature/observations/42")
    const { unmount } = render(<ReturnLink fallbackHref="/nature/observations">← 返回</ReturnLink>)
    expect(screen.getByRole("link", { name: "← 返回" })).toHaveAttribute("href", "/")
    unmount()

    window.history.replaceState(null, "", "/nature/observations/43")
    render(<ReturnLink fallbackHref="/nature/observations">← 返回</ReturnLink>)
    expect(screen.getByRole("link", { name: "← 返回" })).toHaveAttribute("href", "/nature/observations")
  })

  it("MobilePageHeader falls back to the remembered page when there is no history", () => {
    rememberReturnHref("/nature/species/osmoderma-barnabita", "/nature/insects")
    window.history.replaceState(null, "", "/nature/species/osmoderma-barnabita")
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(1)
    render(<MobilePageHeader title="凹背臭斑金龟" fallbackHref="/nature/species" />)
    fireEvent.click(screen.getByRole("button", { name: "返回上一页" }))
    expect(push).toHaveBeenCalledWith("/nature/insects")
    expect(back).not.toHaveBeenCalled()
    lengthSpy.mockRestore()
  })
})
