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
