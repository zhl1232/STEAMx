import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ProjectDetailMobileHeader } from "./project-detail-mobile-header"

function rect(bottom: number) {
  return { top: bottom - 100, bottom, left: 0, right: 320, width: 320, height: 100 }
}

describe("ProjectDetailMobileHeader", () => {
  afterEach(() => {
    document.querySelectorAll('section[id^="project-"]').forEach((element) => element.remove())
  })

  it("reveals mobile chapters once the hero crosses the header and keeps them stable nearby", async () => {
    const hero = document.createElement("section")
    hero.id = "project-hero-mobile"
    let heroBottom = 500
    Object.defineProperty(hero, "getBoundingClientRect", { configurable: true, value: () => rect(heroBottom) })
    document.body.append(hero)

    render(<ProjectDetailMobileHeader title="纸杯实验" backHref="/explore" actions={<button>收藏</button>} />)
    const row = screen.getByRole("banner").querySelector("div") as HTMLDivElement
    Object.defineProperty(row, "getBoundingClientRect", { configurable: true, value: () => rect(56) })
    for (const id of ["project-materials-mobile", "project-steps-mobile", "project-exploration-records-mobile"]) {
      const target = document.createElement("section")
      target.id = id
      Object.defineProperty(target, "getClientRects", { configurable: true, value: () => [{ top: 0, bottom: 20 }] })
      Object.defineProperty(target, "getBoundingClientRect", { configurable: true, value: () => rect(80) })
      document.body.append(target)
    }
    expect(screen.queryByRole("navigation", { name: "项目详情快捷导航" })).not.toBeInTheDocument()

    heroBottom = 50
    window.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(screen.getByRole("navigation", { name: "项目详情快捷导航" })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "材料" })).toHaveAttribute("href", "#project-materials-mobile")

    heroBottom = 55
    window.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(screen.getByRole("navigation", { name: "项目详情快捷导航" })).toBeInTheDocument())
  })

  it("does not show chapters when the hero is absent", () => {
    render(<ProjectDetailMobileHeader title="空数据项目" backHref="/explore" actions={null} />)

    expect(screen.queryByRole("navigation", { name: "项目详情快捷导航" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "返回探索" })).toHaveAttribute("href", "/explore")
  })
})
