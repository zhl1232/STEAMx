import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { ProjectHeroGallery } from "./project-hero-gallery"

const images = ["/cover.webp", "/step-1.webp", "/step-2.webp", "/step-3.webp"]

function swipeHorizontally(target: HTMLElement, fromX: number, toX: number) {
  fireEvent.touchStart(target, {
    changedTouches: [{ clientX: fromX, clientY: 80 }],
  })
  fireEvent.touchEnd(target, {
    changedTouches: [{ clientX: toX, clientY: 80 }],
  })
}

describe("ProjectHeroGallery", () => {
  it("lets people swipe between cover and step photos", () => {
    render(
      <ProjectHeroGallery
        images={images}
        captions={["水循环", "装沙", "加水", "观察"]}
        alt="水循环实验"
        showGradient
      />,
    )

    const photo = screen.getByRole("button", { name: "水循环实验，点击查看大图" })
    expect(screen.getByText("1/4")).toBeInTheDocument()

    swipeHorizontally(photo, 220, 80)

    expect(screen.getByText("2/4")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens a fullscreen preview from a tap, not from a swipe", async () => {
    const user = userEvent.setup()

    render(
      <ProjectHeroGallery
        images={images}
        alt="水循环实验"
      />,
    )

    await user.click(screen.getByRole("button", { name: "水循环实验，点击查看大图" }))

    expect(screen.getByRole("dialog", { name: "项目图片预览" })).toBeInTheDocument()
    expect(screen.getByText("1 / 4")).toBeInTheDocument()
  })

  it("moves with the desktop next control", async () => {
    const user = userEvent.setup()

    render(
      <ProjectHeroGallery
        images={images}
        alt="水循环实验"
      />,
    )

    await user.click(screen.getByRole("button", { name: "下一张" }))

    expect(screen.getByText("2/4")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("hides the counter when there is only one photo", () => {
    render(<ProjectHeroGallery images={["/cover.webp"]} alt="单图项目" />)

    expect(screen.queryByText("1/1")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "下一张" })).not.toBeInTheDocument()
  })
})
