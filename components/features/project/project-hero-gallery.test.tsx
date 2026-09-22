import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { ProjectHeroGallery } from "./project-hero-gallery"
import { ProjectDemoVideo } from "./project-demo-video"

const images = ["/cover.webp", "/step-1.webp", "/step-2.webp", "/step-3.webp"]

describe("ProjectHeroGallery", () => {
  it("shows only the cover, without a carousel or media switch", () => {
    render(<ProjectHeroGallery images={images} alt="水循环实验" />)
    expect(screen.getAllByRole("img")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "下一张" })).not.toBeInTheDocument()
    expect(screen.queryByText("1/4")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "项目图片" })).not.toBeInTheDocument()
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
    expect(screen.queryByText("1 / 4")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "下一张" })).not.toBeInTheDocument()
  })

  it("hides the counter when there is only one photo", () => {
    render(<ProjectHeroGallery images={["/cover.webp"]} alt="单图项目" />)

    expect(screen.queryByText("1/1")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "下一张" })).not.toBeInTheDocument()
  })

  it("shows video directly when both video and images exist", () => {
    const { container } = render(
      <ProjectHeroGallery
        images={["/cover.webp", "/step-1.webp"]}
        videoSrc="/api/assets/qimeng-preview/001_demo/video_1.mp4"
        videoPoster="/cover.webp"
        alt="奇妙潜水艇"
      />,
    )

    const video = container.querySelector("video")
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute("poster", "/cover.webp")
    expect(video?.querySelector("source")).toHaveAttribute(
      "src",
      "/api/assets/qimeng-preview/001_demo/video_1.mp4",
    )
    expect(screen.getByLabelText("奇妙潜水艇 演示视频")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "奇妙潜水艇，点击查看大图" })).not.toBeInTheDocument()
    expect(screen.queryByText("1/2")).not.toBeInTheDocument()

    expect(screen.queryByRole("button", { name: "项目图片" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "演示视频" })).not.toBeInTheDocument()

  })

  it("renders video without a photo switch when no images are available", () => {
    const { container } = render(
      <ProjectHeroGallery
        images={[]}
        videoSrc="/demo.mp4"
        alt="仅视频项目"
      />,
    )

    expect(container.querySelector("video")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "项目图片" })).not.toBeInTheDocument()
  })

  it("shows an inline retry when video playback fails", async () => {
    const user = userEvent.setup()
    const { container } = render(<ProjectDemoVideo src="/broken.mp4" title="演示" />)
    const source = container.querySelector("source") as HTMLSourceElement

    fireEvent.error(source)
    expect(screen.getByText("视频暂时无法播放")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "重试" }))
    expect(screen.queryByText("视频暂时无法播放")).not.toBeInTheDocument()
  })
})
