import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  ExploreAwareContinuationCard,
  ExploreAwareMobileRelated,
  ExploreBackLink,
} from "./explore-project-context"
import { ProjectDetailMobileHeader } from "./project-detail-mobile-header"
import {
  buildExploreProjectContext,
  readExploreProjectContext,
  saveExploreProjectContext,
} from "@/lib/explore/project-navigation-context"
import type { Project } from "@/lib/mappers/types"

const project = (id: number, extra: Partial<Project> = {}): Project => ({
  id,
  title: `项目${id}`,
  author: "作者",
  author_id: "a",
  image: "",
  category: "科学",
  likes: 0,
  description: `描述${id}`,
  ...extra,
})

describe("explore-aware project navigation (no URL params)", () => {
  beforeEach(() => sessionStorage.clear())

  it("falls back to the related project when opened outside explore", () => {
    render(<ExploreAwareContinuationCard projectId={1} fallbackProject={project(9)} fallbackHref="/project/9" />)
    expect(screen.getByText("继续探索这个方向")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /查看推荐项目/ })).toHaveAttribute("href", "/project/9")
  })

  it("offers the next explore card and hands the context on click", () => {
    saveExploreProjectContext(buildExploreProjectContext([project(1), project(2), project(3)], 0, "/explore?tags=%E7%A3%81%E5%8A%9B"))
    render(<ExploreAwareContinuationCard projectId={1} fallbackProject={project(9)} fallbackHref="/project/9" />)

    expect(screen.getByText("继续看下一个项目")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: /前往下一个项目/ })
    expect(link).toHaveAttribute("href", "/project/2")
    expect(link.getAttribute("href")).not.toMatch(/from=|sourceIndex=/)

    fireEvent.click(link)
    expect(readExploreProjectContext(2)?.queue.map((item) => item.id)).toEqual([3])
  })

  it("skips explore cards far too young for the current project", () => {
    const aged = (id: number, age: number) => project(id, {
      classification: { recommendedMinAge: age } as Project["classification"],
    })
    saveExploreProjectContext(buildExploreProjectContext([aged(1, 12), aged(2, 7), aged(3, 10), aged(4, 12)], 0, "/explore"))
    render(<ExploreAwareContinuationCard projectId={1} fallbackProject={project(9)} fallbackHref="/project/9" currentMinAge={12} />)
    const link = screen.getByRole("link", { name: /前往下一个项目/ })
    expect(link).toHaveAttribute("href", "/project/3")
    fireEvent.click(link)
    expect(readExploreProjectContext(3)?.queue.map((item) => item.id)).toEqual([4])
  })

  it("offers returning to the filtered list at the end of the queue", () => {
    saveExploreProjectContext(buildExploreProjectContext([project(1)], 0, "/explore?sortBy=latest"))
    render(<ExploreAwareContinuationCard projectId={1} fallbackProject={null} fallbackHref="/explore" />)
    expect(screen.getByRole("link", { name: /返回探索页/ })).toHaveAttribute("href", "/explore?sortBy=latest")
  })

  it("points 返回探索 links at the filtered explore list", () => {
    saveExploreProjectContext(buildExploreProjectContext([project(5)], 0, "/explore?category=%E7%A7%91%E5%AD%A6"))
    render(
      <>
        <ExploreBackLink projectId={5} fallbackHref="/explore">返回探索</ExploreBackLink>
        <ProjectDetailMobileHeader title="项目5" projectId={5} backHref="/explore" actions={null} />
      </>,
    )
    const links = screen.getAllByRole("link", { name: "返回探索" })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute("href", "/explore?category=%E7%A7%91%E5%AD%A6")
  })

  it("ignores context created for another project", () => {
    saveExploreProjectContext(buildExploreProjectContext([project(7), project(8)], 0, "/explore?tags=x"))
    render(<ExploreBackLink projectId={1} fallbackHref="/explore">返回探索</ExploreBackLink>)
    expect(screen.getByRole("link", { name: "返回探索" })).toHaveAttribute("href", "/explore")
  })

  it("mobile related block follows the explore queue and hides placeholder summaries", () => {
    saveExploreProjectContext(
      buildExploreProjectContext([project(1), project(2, { description: "材料与步骤见正文。" })], 0, "/explore?tags=x"),
    )
    render(<ExploreAwareMobileRelated projectId={1} fallbackProject={null} fallbackHref="/explore" fallbackExploreHref="/explore" />)
    expect(screen.getByRole("link", { name: /项目2/ })).toHaveAttribute("href", "/project/2")
    expect(screen.queryByText("材料与步骤见正文。")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "查看更多" })).toHaveAttribute("href", "/explore?tags=x")
  })
})
