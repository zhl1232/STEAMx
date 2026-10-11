import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { MobileProjectMetaChips } from "./mobile-project-meta-chips"
it("counts viewing points and hides the equipment count while retaining activity counts", () => {
  const { rerender } = render(<MobileProjectMetaChips categoryTone="science" stepsCount={3} materialsCount={2} viewingGuide />)
  expect(screen.getByText("3 项观看要点")).toBeInTheDocument()
  expect(screen.queryByText("2 项材料")).not.toBeInTheDocument()
  rerender(<MobileProjectMetaChips categoryTone="science" stepsCount={3} materialsCount={2} />)
  expect(screen.getByText("3 步")).toBeInTheDocument()
  expect(screen.getByText("2 项材料")).toBeInTheDocument()
})

it("uses the ordinary step count for preparation projects", () => {
  render(<MobileProjectMetaChips categoryTone="science" stepsCount={4} materialsCount={2} practicePending />)
  expect(screen.getByText("4 步")).toBeInTheDocument()
  expect(screen.queryByText(/按说明书操作/)).not.toBeInTheDocument()
})
