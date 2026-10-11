import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ProjectStep } from "@/lib/mappers/types"

import { MobileProjectSteps } from "./mobile-project-steps"

vi.mock("@/components/features/project/project-step-image", () => ({
  ProjectStepImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}))

const steps: ProjectStep[] = [
  { title: "准备纸杯", description: "先拿出纸杯。", image_url: "/one.webp" },
  { title: "观察变化", description: "记录看到的现象。" },
]

describe("MobileProjectSteps", () => {
  it("counts and numbers only real steps, starts with the first expanded, and supports manual toggles", async () => {
    const user = userEvent.setup()
    render(<MobileProjectSteps steps={steps} />)

    expect(screen.getByRole("heading", { name: "探索步骤（共 2 步）" })).toBeInTheDocument()
    expect(screen.getByText("准备纸杯").closest("details")).toHaveAttribute("open")
    expect(screen.getByText("观察变化").closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("准备纸杯").closest("li")).toHaveAttribute("id", "project-step-mobile-1")
    expect(screen.getByText("观察变化").closest("li")).toHaveAttribute("id", "project-step-mobile-2")

    await user.click(screen.getByText("观察变化"))
    expect(screen.getByText("观察变化").closest("details")).toHaveAttribute("open")
    await user.click(screen.getByText("准备纸杯"))
    expect(screen.getByText("准备纸杯").closest("details")).not.toHaveAttribute("open")
  })

  it("expands and collapses all after a manual toggle", async () => {
    const user = userEvent.setup()
    render(<MobileProjectSteps steps={steps} />)

    await user.click(screen.getByText("观察变化"))
    await user.click(screen.getByRole("button", { name: "全部收起" }))
    expect(screen.getByText("准备纸杯").closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("观察变化").closest("details")).not.toHaveAttribute("open")

    await user.click(screen.getByRole("button", { name: "全部展开" }))
    expect(screen.getByText("准备纸杯").closest("details")).toHaveAttribute("open")
    expect(screen.getByText("观察变化").closest("details")).toHaveAttribute("open")
  })

  it("renders a useful empty state without a count or expand control", () => {
    render(<MobileProjectSteps steps={[]} />)

    expect(screen.getByRole("heading", { name: "探索步骤" })).toBeInTheDocument()
    expect(screen.getByText("暂无步骤说明")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /全部/ })).not.toBeInTheDocument()
  })
  it('labels viewing guides as observation points', () => {
    render(<MobileProjectSteps steps={steps} observationOnly />)
    expect(screen.getByRole('heading', { name: '观看要点（共 2 项）' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /探索步骤/ })).not.toBeInTheDocument()
  })
})

it("uses viewing language for empty points and untitled points", () => {
  const { rerender } = render(<MobileProjectSteps steps={[]} observationOnly />)
  expect(screen.getByText("暂无观看要点")).toBeInTheDocument()
  expect(screen.queryByText("暂无步骤说明")).not.toBeInTheDocument()
  rerender(<MobileProjectSteps steps={[{title: "", description: "观察变化"}]} observationOnly />)
  expect(screen.getByText("观看要点 1")).toBeInTheDocument()
})

it('shows manual guidance and the step count for preparation projects', () => {
  render(<MobileProjectSteps steps={steps} practicePending />)
  expect(screen.getByRole('heading', { name: '按说明书操作（共 2 步）' })).toBeInTheDocument()
  expect(screen.getByText('按材料包里的说明书一步步操作；用量、配比和组装方式以说明书为准。')).toBeInTheDocument()
})
