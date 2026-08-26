import { render, screen } from "@testing-library/react"
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
