import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { WorkImageGallery } from "./work-image-gallery"

describe("WorkImageGallery", () => {
  it("opens a fullscreen preview from the in-feed photo", async () => {
    const user = userEvent.setup()

    render(
      <WorkImageGallery
        images={["/works/one.webp", "/works/two.webp"]}
        captions={["正面", "细节"]}
        alt="最终作品图片"
      />,
    )

    expect(screen.getByText("正面")).toBeInTheDocument()
    expect(screen.queryByText("查看大图")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "最终作品图片，点击查看大图" }))

    expect(screen.getByRole("dialog", { name: "作品图片预览" })).toBeInTheDocument()
    expect(screen.getByText("1 / 2")).toBeInTheDocument()
  })

  it("keeps thumbnail switching in the page instead of opening the preview", async () => {
    const user = userEvent.setup()

    render(
      <WorkImageGallery
        images={["/works/one.webp", "/works/two.webp"]}
        captions={["正面", "细节"]}
        alt="最终作品图片"
      />,
    )

    await user.click(screen.getByRole("button", { name: "查看第 2 张图片" }))

    expect(screen.getByText("细节")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the same fullscreen preview from a timeline photo", async () => {
    const user = userEvent.setup()

    render(
      <WorkImageGallery
        layout="feed"
        images={["/works/one.webp"]}
        alt="观察记录图片"
      />,
    )

    await user.click(screen.getByRole("button", { name: "观察记录图片，点击查看大图" }))
    expect(screen.getByRole("dialog", { name: "作品图片预览" })).toBeInTheDocument()
  })
})
