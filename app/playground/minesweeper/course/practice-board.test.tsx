import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { practicePuzzles } from "./lessons-data"
import { PracticeBoard } from "./practice-board"

describe("PracticeBoard", () => {
  it("resets board state when the lesson puzzle changes", async () => {
    const { rerender } = render(<PracticeBoard puzzle={practicePuzzles[1]!} />)

    fireEvent.click(screen.getByRole("button", { name: "标旗" }))
    fireEvent.click(screen.getByRole("button", { name: /第3行第3列，未翻开，目标地雷格/ }))

    expect(await screen.findByText("做对了！推理正确 🎉")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "再试一次" })).toBeInTheDocument()

    rerender(<PracticeBoard puzzle={practicePuzzles[3]!} />)

    await waitFor(() => {
      expect(screen.queryByText("做对了！推理正确 🎉")).not.toBeInTheDocument()
    })

    expect(screen.queryByRole("button", { name: "再试一次" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /第1行第3列，未翻开，目标安全格/ })).toBeEnabled()
  })
})
