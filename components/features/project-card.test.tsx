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
