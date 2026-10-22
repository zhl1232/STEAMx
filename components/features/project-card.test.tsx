import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { Project } from "@/lib/mappers/types"

import { ProjectCard } from "./project-card"

const project: Project = {
  id: 42,
  title: "会跑的小车",
  author: "小明",
  author_id: "author-1",
  image: "",
  category: "工程",
  likes: 3,
  coins_count: 2,
  comments_count: 99,
  completions_count: 5,
}

const classifiedProject: Project = {
  ...project,
  category: "艺术",
  sub_category: "雕塑",
  description: "这段说明只应出现在完整项目卡中。",
  tags: ["泥塑", "手工"],
  classification: {
    recommendedMinAge: 6,
    recommendedMaxAge: null,
    ageLabel: "6 岁起",
    difficultyBand: "beginner",
    difficultyLabel: "入门",
    supportLevel: "guided",
    supportLabel: "建议成人陪同",
    educationStage: "primary",
    educationStageLabel: "小学",
    status: "reviewed",
  },
}

describe.each([
  ["default", undefined],
  ["featured", "featured"],
  ["compact", "compact"],
] as const)("ProjectCard %s variant", (_label, variant) => {
  it("does not present retired project comment counts", () => {
    render(<ProjectCard project={project} variant={variant} />)

    expect(screen.queryByTitle("评论数")).not.toBeInTheDocument()
    expect(screen.getByTitle("作品数")).toBeInTheDocument()
    expect(screen.queryByText("99")).not.toBeInTheDocument()
    expect(screen.queryByText("99 评论")).not.toBeInTheDocument()
  })
})

describe.each([
  { variant: 'default' },
  { variant: 'default', mobileCompact: true },
  { variant: 'featured' },
  { variant: 'compact', compactLayout: 'adaptive' },
  { variant: 'compact', compactLayout: 'vertical' },
  { variant: 'compact', compactLayout: 'dense' },
  { variant: 'explore' },
] as const)('ProjectCard title anchor $variant $compactLayout', props => {
  it('puts the visible highlighted title inside one native link and one tab stop', async () => {
    const user = userEvent.setup()
    const { container } = render(<>
      <ProjectCard project={project} {...props} searchQuery="小车" href="/project/42/records" scroll={false} />
      <button>下一项</button>
    </>)
    const link = screen.getByRole('link', { name: /会跑的小车/ })
    expect(link).toHaveAttribute('href', '/project/42/records')
    expect(link).toHaveTextContent(project.title)
    expect(screen.getByRole('heading', { name: /会跑的小车/ })).toContainElement(link)
    expect(link.querySelector('mark')).toHaveTextContent('小车')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(container.querySelector('a a, a button, a [tabindex]')).toBeNull()
    await user.tab()
    expect(link).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus()
  })

  it('keeps the default canonical project destination', () => {
    render(<ProjectCard project={project} {...props} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/project/42')
  })
})

describe("ProjectCard tags", () => {
  it("does not render qimeng-src tracking tags", () => {
    render(
      <ProjectCard
        project={{
          ...classifiedProject,
          category: "科学",
          sub_category: undefined,
          tags: ["启蒙版", "qimeng-src:1071409", "科学实验"],
        }}
      />,
    )

    expect(screen.getByText("启蒙版")).toBeInTheDocument()
    expect(screen.queryByText("qimeng-src:1071409")).not.toBeInTheDocument()
  })
})

describe("ProjectCard compact vertical variant", () => {
  it("keeps the scan essentials and removes secondary copy", () => {
    render(
      <ProjectCard
        project={classifiedProject}
        variant="compact"
        compactLayout="vertical"
      />,
    )

    expect(screen.getByText("艺术 · 雕塑")).toBeInTheDocument()
    expect(screen.getByLabelText("适龄 6 岁起，难度 入门，建议成人陪同")).toHaveTextContent(
      "6 岁起 · 入门 · 建议成人陪同",
    )
    expect(screen.queryByText("这段说明只应出现在完整项目卡中。")).not.toBeInTheDocument()
    expect(screen.queryByText("泥塑")).not.toBeInTheDocument()
  })
})

describe("ProjectCard explore variant", () => {
  it("keeps zero likes visible alongside works without coin stats", () => {
    render(
      <ProjectCard
        project={{ ...classifiedProject, likes: 0, completions_count: 2, coins_count: 8 }}
        variant="explore"
      />,
    )

    expect(screen.getByText("艺术 · 雕塑")).toBeInTheDocument()
    expect(screen.getByLabelText("适龄 6 岁起，建议成人陪同")).toHaveTextContent(
      "6 岁起建议成人陪同",
    )
    expect(screen.queryByText("入门")).not.toBeInTheDocument()
    expect(screen.getByText("2 作品")).toBeInTheDocument()
    expect(screen.getByText("0 点赞")).toBeInTheDocument()
    expect(screen.queryByText("0 投币")).not.toBeInTheDocument()
    expect(screen.getByTitle("点赞数")).toBeInTheDocument()
    expect(screen.queryByTitle("投币数")).not.toBeInTheDocument()
  })

  it("keeps both stats when all values are zero", () => {
    render(<ProjectCard project={{ ...classifiedProject, likes: 0, completions_count: 0, coins_count: 0 }} variant="explore" />)
    expect(screen.getByTestId("explore-project-stats")).toHaveTextContent("0 点赞0 作品")
  })
})

describe("ProjectCard material matching", () => {
  const match = { requiredCount: 4, ownedCount: 2, missingLabels: ["浅盘", "纸杯"], hasSelection: true }

  it("introduces the material count before a selection", () => {
    render(<ProjectCard project={classifiedProject} variant="explore" materialMatch={{ ...match, hasSelection: false }} />)

    expect(screen.getByText("4 样材料")).toBeInTheDocument()
    expect(screen.queryByText("点选上方材料来匹配")).not.toBeInTheDocument()
    expect(screen.queryByText(classifiedProject.description!)).not.toBeInTheDocument()
  })

  it("shows selected counts and the two missing materials", () => {
    render(<ProjectCard project={{ ...classifiedProject, image: "/test-project.jpg" }} variant="explore" materialMatch={match} href="/project/42?from=materials" />)

    expect(screen.getByText("需要 4 样，你有 2 样")).toBeInTheDocument()
    expect(screen.getByText("还差：浅盘、纸杯")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看项目：会跑的小车" })).toHaveAttribute("href", "/project/42?from=materials")
    expect(screen.getByRole("img", { name: "会跑的小车" })).toBeInTheDocument()
    expect(screen.getByLabelText("3 点赞")).toBeInTheDocument()
    expect(screen.getByLabelText("5 作品")).toBeInTheDocument()
    expect(screen.getByText("艺术 · 雕塑")).toBeInTheDocument()
    expect(screen.queryByLabelText("适龄 6 岁起，建议成人陪同")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("retains a long missing label for access while truncating its displayed line", () => {
    const label = "长材料名称（附带必须保留的安全说明和数量备注）"
    render(<ProjectCard project={project} variant="explore" materialMatch={{ ...match, missingLabels: [label] }} />)

    const line = screen.getByText(`还差：${label}`)
    expect(line).toHaveClass("truncate", "min-w-0")
    expect(line.parentElement).toHaveAttribute("title", `还差：${label}`)
  })

  it("bounds more than two missing materials to a count", () => {
    render(<ProjectCard project={project} variant="explore" materialMatch={{ ...match, missingLabels: ["浅盘", "纸杯", "吸管"] }} />)

    expect(screen.getByText("还差 3 样")).toBeInTheDocument()
    expect(screen.queryByText(/浅盘/)).not.toBeInTheDocument()
  })

  it("marks a complete selection with a semantic success color and check", () => {
    render(<ProjectCard project={project} variant="explore" materialMatch={{ ...match, ownedCount: 4, missingLabels: [] }} />)

    expect(screen.getByText("需要 4 样，你有 4 样")).toBeInTheDocument()
    const line = screen.getByText("材料已匹配").parentElement!
    expect(line).toHaveClass("text-[hsl(var(--status-success))]")
    expect(line.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
  })

  it("uses an honest fallback for unknown material information", () => {
    render(<ProjectCard project={project} variant="explore" materialMatch={null} />)

    expect(screen.getByText("材料信息待核对")).toBeInTheDocument()
    expect(screen.getByText("点进项目查看清单")).toBeInTheDocument()
    expect(screen.queryByText(/^0 样材料$/)).not.toBeInTheDocument()
  })

  it("keeps bounded matching slots but restores natural ordinary card content when matching switches off", () => {
    const { container, rerender } = render(<ProjectCard project={classifiedProject} variant="explore" materialMatch={match} />)
    const surface = container.querySelector(".surface-card")!
    expect(surface).toHaveClass("h-full", "flex", "flex-col", "p-0")
    expect(surface).not.toHaveClass("grid")
    expect(container.querySelector(".aspect-16\\/10")).toHaveClass("md:aspect-video")
    expect(screen.getByText("需要 4 样，你有 2 样").parentElement).toHaveClass("h-11", "leading-5")
    expect(screen.getByRole("heading", { name: `查看项目：${classifiedProject.title}` })).toHaveClass("h-12")
    const matchingGeometry = surface.className

    rerender(<ProjectCard project={classifiedProject} variant="explore" />)

    expect(screen.queryByText(/需要 4 样/)).not.toBeInTheDocument()
    expect(screen.queryByText(classifiedProject.description!)).not.toBeInTheDocument()
    expect(screen.getByText("艺术 · 雕塑").parentElement).not.toHaveClass("h-11", "justify-between")
    expect(screen.getByLabelText("适龄 6 岁起，建议成人陪同")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: `查看项目：${classifiedProject.title}` })).not.toHaveClass("h-12")
    expect(container.querySelector(".surface-card")).toHaveAttribute("class", matchingGeometry)
  })

  it("does not reserve a classification row for ordinary projects without classification", () => {
    const { container } = render(<ProjectCard project={project} variant="explore" />)

    expect(screen.getByText("工程")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: `查看项目：${project.title}` })).not.toHaveClass("h-12")
    expect(container.querySelector(".h-11")).not.toBeInTheDocument()
    expect(screen.queryByText(/样材料/)).not.toBeInTheDocument()
  })

  it.each(["default", "featured", "compact"] as const)("ignores matching for the %s variant", (variant) => {
    render(<ProjectCard project={project} variant={variant} materialMatch={match} />)

    expect(screen.queryByText(/需要 4 样/)).not.toBeInTheDocument()
    expect(screen.queryByText("还差：浅盘、纸杯")).not.toBeInTheDocument()
    expect(screen.getByTitle(variant === "featured" ? "硬币数" : "投币数")).toBeInTheDocument()
  })
})
