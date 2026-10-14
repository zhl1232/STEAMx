import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Work } from "@/lib/mappers/types"
import { WorkCard, WorkCardGrid, workCardKey } from "./work-card-grid"

vi.mock("next/link", () => ({
  default: ({ href, children, className, "aria-label": ariaLabel }: {
    href: string; children: React.ReactNode; className?: string; "aria-label"?: string
  }) => <a href={href} className={className} aria-label={ariaLabel}>{children}</a>,
}))

function makeWork(source?: Work["source"]): Work {
  return {
    id: 42,
    userId: "author-1",
    projectId: source?.type === "project" ? source.id : null,
    author: "小明",
    completedAt: "2026/10/01",
    proofImages: [],
    isPublic: true,
    likes: 3,
    coins: 0,
    commentsCount: 2,
    status: "approved",
    recordKind: "final",
    source,
  }
}

const courseSource: NonNullable<Work["source"]> = {
  type: "course_lesson",
  id: 12,
  title: "长颈龙",
  href: "/courses/2/lessons/12",
  courseId: 2,
  courseTitle: "中班建构课堂",
}

const cases: Array<{
  source: NonNullable<Work["source"]>
  caption: string
  href: string
  badge: string
}> = [
  { source: courseSource, caption: "课程作品 · 中班建构课堂", href: "/works/42", badge: "课程" },
  {
    source: { type: "project", id: 7, title: "纸桥", href: "/project/7" },
    caption: "项目作品", href: "/works/42", badge: "项目",
  },
  {
    source: { type: "challenge", id: 8, title: "桥梁方案", href: "/pbl/8/submissions/42", challengeTitle: "承重挑战" },
    caption: "挑战作品 · 承重挑战", href: "/pbl/8/submissions/42", badge: "挑战",
  },
  {
    source: { type: "observation", id: 9, title: "校园里的鸟", href: "/nature/observations/9", locationName: "校园" },
    caption: "自然观察 · 校园", href: "/nature/observations/9", badge: "观察",
  },
]

describe("WorkCard homepage presentation", () => {
  it.each(cases)("puts the author before $caption without changing the destination", ({ source, caption, href, badge }) => {
    render(<WorkCardGrid works={[makeWork(source)]} variant="showcase" />)
    expect(screen.getByRole("heading", { name: source.title })).toBeInTheDocument()
    expect(screen.getByText("小明", { selector: "span.hidden" })).toHaveClass("md:inline")
    expect(screen.getByText(badge, { exact: true })).toHaveClass("md:hidden")
    const sourceLine = screen.getByText(caption, { exact: true })
    expect(sourceLine).toHaveClass("hidden", "md:block")
    expect(sourceLine).toHaveAttribute("title", caption)
    expect(screen.getByRole("link")).toHaveAttribute("href", href)
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(screen.getByTitle("点赞数")).toHaveTextContent("3")
    expect(screen.getByTitle("留言数")).toHaveTextContent("2")
  })

  it("leaves other pages on the existing default presentation", () => {
    render(<WorkCardGrid works={[makeWork(courseSource)]} />)
    expect(screen.getByText("课程", { exact: true })).not.toHaveClass("md:hidden")
    expect(screen.getByText("中班建构课堂", { exact: true })).toBeInTheDocument()
    expect(screen.queryByText("课程作品 · 中班建构课堂", { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看课程作品：长颈龙" })).toHaveAttribute("href", "/works/42")
  })

  it("retains the existing course context for mobile cards", () => {
    render(<WorkCard work={makeWork(courseSource)} variant="showcase" />)
    expect(screen.getByText("中班建构课堂", { exact: true })).toHaveClass("md:hidden")
    expect(screen.getByText("小明", { selector: "span.hidden" })).toHaveClass("hidden", "md:inline")
  })

  it("keeps missing-source and moderation fallbacks", () => {
    render(<WorkCard work={{ ...makeWork(), author: "", status: "pending" }} variant="showcase" />)
    expect(screen.getByRole("heading", { name: "作品" })).toBeInTheDocument()
    expect(screen.getByText("创作者")).toBeInTheDocument()
    expect(screen.getByText("审核中")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/works/42")
  })

  it("still distinguishes identical IDs from different source types", () => {
    expect(workCardKey(makeWork(cases[0].source))).not.toBe(workCardKey(makeWork(cases[1].source)))
  })
})
