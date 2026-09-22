import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ProjectStepImage } from "./project-step-image"

vi.mock("@/components/features/shared/image-lightbox", () => ({
  ImageLightbox: ({ open, onOpenChange, alt }: { open: boolean; onOpenChange: (open: boolean) => void; alt: string }) =>
    open ? <div role="dialog" aria-label="步骤图片预览"><span>{alt}</span><button onClick={() => onOpenChange(false)}>关闭</button></div> : null,
}))

describe("ProjectStepImage", () => {
  it("opens the single image preview from click and keyboard", async () => {
    const user = userEvent.setup()
    render(<ProjectStepImage src="/step.webp" alt="把水倒入杯中" />)

    const image = screen.getByRole("button", { name: "放大查看：把水倒入杯中" })
    await user.click(image)
    expect(await screen.findByRole("dialog", { name: "步骤图片预览" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "关闭" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    image.focus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog", { name: "步骤图片预览" })).toBeInTheDocument()
  })

  it("shows a retry action when the image fails", async () => {
    render(<ProjectStepImage src="/broken.webp" alt="实验步骤" />)
    const optimizedImage = screen.getByAltText("实验步骤")
    fireEvent.error(optimizedImage)

    expect(await screen.findByText("图片加载失败")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByAltText("实验步骤")).not.toBeInTheDocument())
  })

  it("keeps retry keyboard interaction separate from opening the preview", async () => {
    const user = userEvent.setup()
    render(<ProjectStepImage src="/broken.webp" alt="实验步骤" />)
    fireEvent.error(screen.getByAltText("实验步骤"))

    const retry = screen.getByRole("button", { name: "重试" })
    retry.focus()
    await user.keyboard("{Enter}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByAltText("实验步骤")).toBeInTheDocument()
  })
})
