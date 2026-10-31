import { useEffect } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NativeLessonId, SceneItemId } from "@/lib/textbook3d/native/native-lessons"
import PlantLesson from "./plant-lesson"

const canvasMount = vi.hoisted(() => vi.fn())

// WebGL projection and raycasting are the boundary here. Clicking this canvas
// reports a hit on the selected model, while React owns selection and labels.
vi.mock("./plant-canvas", () => ({
  PlantCanvas: ({ lessonId, plant, page, interaction, showTreeLabels, onSelect }: {
    lessonId: NativeLessonId
    plant: SceneItemId
    page: number
    interaction: number
    showTreeLabels: boolean
    onSelect: (plant: SceneItemId) => void
  }) => {
    useEffect(() => { canvasMount() }, [])
    return <canvas data-testid="lesson-canvas" aria-label="课本模型画布"
      data-lesson={lessonId} data-plant={plant} data-page={page} data-interaction={interaction}
      data-labels-open={showTreeLabels} onClick={() => onSelect(plant)} />
  },
}))

function observationLesson(onComplete = vi.fn()) {
  render(<PlantLesson lessonId="p1a-1-2" title="观察植物" onComplete={onComplete} onUseLegacy={vi.fn()} />)
  return onComplete
}

function reading() {
  return screen.getByRole("region", { name: "课文与探索任务" })
}

function contentsEntries() {
  return within(within(reading()).getByRole("list")).getAllByRole("button")
}

function selector() {
  return screen.getByRole("group", { name: "选择观察的植物" })
}

describe("second lesson observation reader", () => {
  beforeEach(() => { canvasMount.mockClear() })

  it("starts with two real contents entries and retains the observation question and its tasting feedback", () => {
    const completed = observationLesson()
    expect(within(reading()).getByRole("heading", { name: "目录" })).toBeInTheDocument()
    expect(screen.getByText("本课目录")).toBeInTheDocument()
    const entries = contentsEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent("观察植物1")
    expect(entries[1]).toHaveTextContent("试一试：叶 / 茎 / 花2")
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled()
    fireEvent.click(entries[0])
    expect(within(reading()).getByRole("heading", { name: "观察植物" })).toBeInTheDocument()
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument()
    const question = screen.getByRole("group", { name: "观察植物时，可以用什么？" })
    expect(within(question).getAllByRole("button", { pressed: false }).map((button) => button.getAttribute("aria-label"))).toEqual(["眼睛和手", "嘴巴尝", "不用看"])
    expect(within(question).getByRole("button", { name: "眼睛和手" })).toHaveTextContent("A眼睛和手")
    expect(within(question).getByRole("button", { name: "翻开看答案" })).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(within(question).getByRole("button", { name: "嘴巴尝" }))
    expect(within(question).getByRole("button", { name: "合上答案卡" })).toHaveAttribute("aria-expanded", "true")
    expect(within(question).getByRole("status")).toHaveTextContent("不能随便尝")
    expect(within(question).getByRole("button", { name: "嘴巴尝" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(question).getByRole("button", { name: "眼睛和手" }))
    expect(within(question).getByRole("status")).toHaveTextContent("用眼睛看、用手摸，不能随便尝。")
    expect(screen.getByText("屏幕里先看；触感要观察真实植物。")).toBeInTheDocument()
    expect(completed).not.toHaveBeenCalled()
  })

  it("can inspect the observation answer before choosing, without recording a model interaction", () => {
    const completed = observationLesson()
    fireEvent.click(contentsEntries()[0])
    const question = screen.getByRole("group", { name: "观察植物时，可以用什么？" })
    fireEvent.click(within(question).getByRole("button", { name: "翻开看答案" }))
    expect(within(question).getByRole("status")).toHaveTextContent("用眼睛看、用手摸，不能随便尝。")
    expect(within(question).getAllByRole("button", { pressed: false })).toHaveLength(3)
    fireEvent.click(within(question).getByRole("button", { name: "合上答案卡" }))
    expect(within(question).queryByRole("status")).toBeNull()
    expect(screen.getByTestId("lesson-canvas")).toHaveAttribute("data-interaction", "0")
    fireEvent.click(screen.getByRole("button", { name: "下一页" }))
    expect(within(screen.getByRole("table")).getAllByText("点模型看一看")).toHaveLength(3)
    expect(completed).not.toHaveBeenCalled()
  })

  it("shows the selected model's one, three, or two labels and a second hit closes them without deselecting", () => {
    const completed = observationLesson()
    fireEvent.click(contentsEntries()[0])
    const canvas = screen.getByTestId("lesson-canvas")
    let interactions = 0
    for (const [id, name, labels] of [
      ["leaf", "叶", ["叶脉"]],
      ["stem", "茎", ["根", "茎", "叶"]],
      ["flower", "花", ["花瓣", "花心"]],
    ] as const) {
      const button = within(selector()).getByRole("button", { name })
      fireEvent.click(button)
      expect(canvas).toHaveAttribute("data-interaction", String(++interactions))
      expect(button).toHaveAttribute("aria-pressed", "true")
      expect(within(selector()).getAllByRole("button").filter((item) => item.getAttribute("aria-pressed") === "true")).toHaveLength(1)
      expect(canvas).toHaveAttribute("data-plant", id)
      expect(canvas).toHaveAttribute("data-labels-open", "true")
      expect(Array.from(document.querySelectorAll("[data-tree-bubble]")).map((bubble) => bubble.textContent)).toEqual(labels)
      const announcement = `${name}上标出了${labels.join("、")}。再点可收起。`
      expect(screen.getByText(announcement)).toHaveAttribute("role", "status")
      fireEvent.click(canvas)
      expect(canvas).toHaveAttribute("data-interaction", String(++interactions))
      expect(canvas).toHaveAttribute("data-labels-open", "false")
      expect(canvas).toHaveAttribute("data-plant", id)
      expect(button).toHaveAttribute("aria-pressed", "true")
      expect(screen.queryByText(announcement)).toBeNull()
    }
    expect(completed).not.toHaveBeenCalled()
    expect(canvasMount).toHaveBeenCalledOnce()
  })

  it("records discoveries only after exploration and completes only on the explicit record action", () => {
    const completed = observationLesson()
    fireEvent.click(contentsEntries()[1])
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["部位", "样子", "我发现"])
    expect(within(table).getAllByText("点模型看一看")).toHaveLength(3)
    const rows = within(table).getAllByRole("row").slice(1)
    for (const [index, name, discovery] of [[0, "叶", "有叶脉"], [1, "茎", "连着叶和根"], [2, "花", "有花瓣"]] as const) {
      fireEvent.click(within(selector()).getByRole("button", { name }))
      expect(within(rows[index]).getByText(discovery)).toBeInTheDocument()
      expect(rows[index]).toHaveAttribute("data-selected", "true")
      expect(within(table).queryAllByText("点模型看一看")).toHaveLength(2 - index)
      expect(completed).not.toHaveBeenCalled()
    }
    fireEvent.click(screen.getByTestId("lesson-canvas"))
    expect(within(rows[2]).getByText("有花瓣")).toBeInTheDocument()
    expect(rows[2]).toHaveAttribute("data-selected", "true")
    expect(screen.getByRole("heading", { name: "画一画你观察的植物。" })).toBeInTheDocument()
    expect(screen.queryByText("会仔细看")).toBeNull()
    expect(completed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "记录本次探索" }))
    expect(completed).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "本次已探索" })).toBeDisabled()
    expect(screen.getByText("只记录这次探索，不判断你是否已经掌握。")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "返回本课目录" }))
    fireEvent.click(contentsEntries()[1])
    expect(screen.getByRole("button", { name: "本次已探索" })).toBeDisabled()
    expect(within(screen.getByRole("table")).queryByText("点模型看一看")).toBeNull()
    expect(completed).toHaveBeenCalledOnce()
  })

  it("navigates both body pages and the separate contents without replacing its canvas", () => {
    observationLesson()
    const canvas = screen.getByTestId("lesson-canvas")
    expect(canvas).toHaveAttribute("data-lesson", "p1a-1-2")
    expect(canvas).toHaveAttribute("data-page", "-1")
    fireEvent.click(contentsEntries()[1])
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "试一试：叶 / 茎 / 花" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "上一页" }))
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "返回本课目录" }))
    expect(contentsEntries()).toHaveLength(2)
    expect(screen.getByText("本课目录")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "下一页" }))
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument()
    expect(screen.queryByText(/第 \d \/ 3 页/)).toBeNull()
    expect(screen.getByTestId("lesson-canvas")).toBe(canvas)
    expect(screen.getAllByTestId("lesson-canvas")).toHaveLength(1)
    expect(canvasMount).toHaveBeenCalledOnce()
  })
})

describe("first lesson contents regression", () => {
  it("keeps the contents outside its two body-page numbers and allows direct entry to either page", () => {
    canvasMount.mockClear()
    render(<PlantLesson title="我们知道的植物" onUseLegacy={vi.fn()} />)
    const canvas = screen.getByTestId("lesson-canvas")
    let entries = contentsEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent("我们知道的植物1")
    expect(entries[1]).toHaveTextContent("带着发现去找一找2")
    fireEvent.click(entries[1])
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "说出 5 种你认识的植物" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "返回本课目录" }))
    entries = contentsEntries()
    fireEvent.click(entries[0])
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: /猜一猜：\s*哪个是植物？/ })).toBeInTheDocument()
    expect(screen.queryByText(/第 \d \/ 3 页/)).toBeNull()
    expect(screen.getByTestId("lesson-canvas")).toBe(canvas)
    expect(canvasMount).toHaveBeenCalledOnce()
  })
})
