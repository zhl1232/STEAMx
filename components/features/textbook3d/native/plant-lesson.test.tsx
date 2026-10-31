import { useEffect, useLayoutEffect, useRef } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlantLesson from "./plant-lesson"

const canvasMount = vi.hoisted(() => vi.fn())
const canvasBoundary = vi.hoisted(() => ({ turn: undefined as ((busy: boolean) => void) | undefined, animate: false }))
vi.mock("./plant-canvas", () => ({ PlantCanvas: ({ plant, page, onTurningChange }: { plant: string; page: number; onTurningChange?: (busy: boolean) => void }) => {
  const previousPage = useRef(page)
  useLayoutEffect(() => {
    if (canvasBoundary.animate && previousPage.current !== page) onTurningChange?.(true)
    previousPage.current = page
  }, [page, onTurningChange])
  useEffect(() => { canvasBoundary.turn = onTurningChange }, [onTurningChange])
  useEffect(() => { canvasMount() }, [])
  return <div data-testid="plant-canvas">{plant}</div>
} }))

describe("first lesson reader", () => {
  beforeEach(() => { canvasBoundary.animate = false })

  it("resets the actual reading scroll position in both page directions", () => {
    render(<PlantLesson title="我们知道的植物" onUseLegacy={vi.fn()} />)
    const reading = screen.getByRole("region", { name: "课文与探索任务" })
    const body = reading.closest<HTMLElement>("[data-book-spread]")!
    for (const button of ["下一页", "上一页", "下一页"]) {
      reading.scrollTop = 480
      body.scrollTop = 220
      fireEvent.click(screen.getByRole("button", { name: button }))
      expect(reading.scrollTop).toBe(0)
      expect(body.scrollTop).toBe(0)
      expect(document.activeElement).toBe(within(reading).getByRole("heading", { level: 2 }))
    }
  })

  it("waits until the reading surface is available before moving focus to its new heading", () => {
    canvasBoundary.animate = true
    render(<PlantLesson title="我们知道的植物" onUseLegacy={vi.fn()} />)
    const next = screen.getByRole("button", { name: "下一页" })
    next.focus()
    fireEvent.click(next)
    const heading = screen.getByRole("heading", { name: "带着发现去找一找" })
    expect(document.activeElement).not.toBe(heading)
    expect(screen.getByRole("region", { name: "课文与探索任务" })).toHaveAttribute("aria-busy", "true")
    act(() => canvasBoundary.turn?.(false))
    expect(document.activeElement).toBe(heading)
    expect(screen.getByRole("region", { name: "课文与探索任务" })).toHaveAttribute("aria-busy", "false")
  })
  it("uses two pages and keeps one canvas mounted while changing page and plant", () => {
    canvasMount.mockClear()
    render(<PlantLesson title="我们知道的植物" onUseLegacy={vi.fn()} />)
    expect(screen.getByText(/第 1 \/ 2 页/)).toBeInTheDocument()
    const selector = screen.getByRole("group", { name: "选择观察的植物" })
    fireEvent.click(within(selector).getByRole("button", { name: "小草" }))
    fireEvent.click(screen.getByRole("button", { name: "下一页" }))
    expect(screen.getByText(/第 2 \/ 2 页/)).toBeInTheDocument()
    expect(screen.getByTestId("plant-canvas")).toHaveTextContent("grass")
    expect(screen.getByText("观察小记录 · 已选过 1 种示例")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "上一页" }))
    expect(canvasMount).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: /演示|播放|摇一摇|静止/ })).toBeNull()
  })

  it("exploring examples does not automatically pass the five-plant challenge", () => {
    const onComplete = vi.fn()
    render(<PlantLesson title="我们知道的植物" onComplete={onComplete} onUseLegacy={vi.fn()} />)
    const selector = screen.getByRole("group", { name: "选择观察的植物" })
    for (const name of ["大树", "小草", "花"]) fireEvent.click(within(selector).getByRole("button", { name }))
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "下一页" }))
    expect(screen.getByText("说出 5 种你认识的植物")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "记录本次探索" }))
    expect(onComplete).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "本次已探索" })).toBeDisabled()
    expect(screen.getByText("只记录这次探索，不判断你是否已经掌握。")).toBeInTheDocument()
  })

  it("retains the plant question and offers an explicit legacy fallback", () => {
    const fallback = vi.fn()
    render(<PlantLesson title="我们知道的植物" onUseLegacy={fallback} />)
    const question = screen.getByRole("group", { name: "猜一猜：哪个是植物？" })
    fireEvent.click(within(question).getByRole("button", { name: "石头" }))
    expect(screen.getByText("石头不会生长，再找找看。")).toBeInTheDocument()
    fireEvent.click(within(question).getByRole("button", { name: "小草" }))
    expect(screen.getByText("对，小草是植物，它会生长。")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "使用旧版" }))
    expect(fallback).toHaveBeenCalledOnce()
  })

  it("blocks competing page/plant changes during a turn while keeping fullscreen exit available", () => {
    render(<PlantLesson title="我们知道的植物" onUseLegacy={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "全屏阅读" }))
    fireEvent.click(screen.getByRole("button", { name: "下一页" }))
    act(() => canvasBoundary.turn?.(true))
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled()
    expect(within(screen.getByRole("group", { name: "选择观察的植物" })).getByRole("button", { name: "花" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "退出全屏" }))
    expect(screen.getByRole("button", { name: "全屏阅读" })).toBeEnabled()
    act(() => canvasBoundary.turn?.(false))
    fireEvent.click(screen.getByRole("button", { name: "上一页" }))
    expect(screen.getByText(/第 1 \/ 2 页/)).toBeInTheDocument()
  })

})
