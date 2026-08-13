import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ImageLightbox } from "./image-lightbox"

const images = ["/photos/one.jpg", "/photos/two.jpg", "/photos/three.jpg"]

describe("ImageLightbox", () => {
  it("shows the active photo and lets desktop users move to the next one", async () => {
    const user = userEvent.setup()
    const onIndexChange = vi.fn()

    render(
      <ImageLightbox
        open
        onOpenChange={vi.fn()}
        images={images}
        index={0}
        onIndexChange={onIndexChange}
        alt="迷宫作品"
        title="作品图片预览"
      />,
    )

    expect(screen.getByRole("dialog", { name: "作品图片预览" })).toBeInTheDocument()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "下一张" }))

    expect(onIndexChange).toHaveBeenCalledWith(1)
    expect(screen.getByText("2 / 3")).toBeInTheDocument()
  })

  it("moves with arrow keys and does not wrap past the last photo", async () => {
    const user = userEvent.setup()
    const onIndexChange = vi.fn()

    render(
      <ImageLightbox
        open
        onOpenChange={vi.fn()}
        images={images}
        index={2}
        onIndexChange={onIndexChange}
        alt="迷宫作品"
        title="作品图片预览"
      />,
    )

    await user.keyboard("{ArrowRight}")
    expect(onIndexChange).not.toHaveBeenCalled()

    await user.keyboard("{ArrowLeft}")
    expect(onIndexChange).toHaveBeenCalledWith(1)
  })

  it("closes from the dialog close control", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <ImageLightbox
        open
        onOpenChange={onOpenChange}
        images={images}
        index={0}
        alt="迷宫作品"
        title="作品图片预览"
      />,
    )

    await user.click(screen.getByRole("button", { name: "关闭" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
