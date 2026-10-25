import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MathKeyboard, ParameterTools } from "./expression-tools"

function Tools({ disabled = false, immersive = false }: { disabled?: boolean; immersive?: boolean }) {
    const [expression, setExpression] = useState("0")
    return <><input aria-label="表达式" value={expression} onChange={(event) => setExpression(event.target.value)} /><ParameterTools expression={expression} onChange={setExpression} disabled={disabled} immersive={immersive} /><MathKeyboard setExpression={setExpression} disabled={disabled} requiredTokens={new Set(["sin("])} /></>
}

describe("function teaching tools", () => {
    it("opens a compact keyboard and reveals additional functions on demand", () => {
        render(<Tools />)
        expect(screen.getByText("数学键盘").closest("details")).not.toHaveAttribute("open")
        fireEvent.click(screen.getByText("数学键盘"))
        expect(screen.getByRole("button", { name: "sin(" })).toBeEnabled()
        expect(screen.queryByRole("button", { name: "log(" })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "更多函数" }))
        fireEvent.click(screen.getByRole("button", { name: "x" }))
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("x")
    })

    it("adjusts a meaningful parameter and preserves the expression on switching to free input", () => {
        render(<Tools />)
        fireEvent.click(screen.getByText("调参数试一试"))
        fireEvent.click(screen.getByRole("button", { name: "斜线" }))
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("0.25*x")
        fireEvent.change(screen.getByRole("slider", { name: "斜率 a" }), { target: { value: "0.4" } })
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("0.4*x")
        fireEvent.click(screen.getByRole("button", { name: "切换到自由输入" }))
        expect(screen.queryByRole("slider")).not.toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("0.4*x")
        fireEvent.change(screen.getByRole("textbox", { name: "表达式" }), { target: { value: "abs(x)" } })
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("abs(x)")
    })
    it("keeps immersive sliders outside the chooser and retains them across layout changes", () => {
        const { rerender } = render(<Tools immersive />)
        fireEvent.click(screen.getByText("模板"))
        fireEvent.click(screen.getByRole("button", { name: "波浪" }))
        const chooser = screen.getByText("模板").closest("details")
        expect(chooser).not.toHaveAttribute("open")
        expect(screen.getByText("模板")).toHaveFocus()
        expect(screen.getByRole("slider", { name: "振幅 a" })).toBeVisible()
        fireEvent.change(screen.getByRole("slider", { name: "振幅 a" }), { target: { value: "3" } })
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("3*sin(0.5*x)")
        rerender(<Tools />)
        fireEvent.click(screen.getByText("调参数试一试"))
        expect(screen.getByRole("slider", { name: "振幅 a" })).toHaveValue("3")
        rerender(<Tools immersive />)
        fireEvent.click(screen.getByRole("button", { name: "关闭调参，保留函数" }))
        expect(screen.queryByRole("slider")).not.toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "表达式" })).toHaveValue("3*sin(0.5*x)")
    })

    it("closes the compact template chooser with Escape", () => {
        render(<Tools immersive />)
        const trigger = screen.getByText("模板")
        fireEvent.click(trigger)
        // JSDOM does not run native details toggling for fireEvent.
        trigger.closest("details")!.open = true
        fireEvent.keyDown(trigger, { key: "Escape" })
        expect(trigger.closest("details")).not.toHaveAttribute("open")
        expect(trigger).toHaveFocus()
    })
    it("disables parameter editing when the game has ended", () => {
        const { rerender } = render(<Tools />)
        fireEvent.click(screen.getByText("调参数试一试"))
        fireEvent.click(screen.getByRole("button", { name: "斜线" }))
        rerender(<Tools disabled />)
        expect(screen.getByRole("slider", { name: "斜率 a" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "抛物线" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "切换到自由输入" })).toBeDisabled()
    })

})
