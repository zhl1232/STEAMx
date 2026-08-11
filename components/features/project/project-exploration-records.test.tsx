import type { ReactNode } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectCompletion } from "@/lib/mappers/types"

import {
  ProjectExplorationRecordsBlock,
  ProjectExplorationRecordsHorizontal,
} from "./project-exploration-records"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ alt = "" }: { alt?: string }) => <span role="img" aria-label={alt} />,
}))

const finalWork: ProjectCompletion = {
  id: 42,
  userId: "user-1",
  projectId: 7,
  author: "小明",
  completedAt: "刚刚",
  proofImages: [],
  notes: "这是我的作品。",
  isPublic: true,
  likes: 3,
  coins: 0,
  status: "approved",
  recordKind: "final",
}

describe("ProjectExplorationRecords guidance", () => {
  it("takes a final work directly to its detail page with the comment entry", () => {
    render(<ProjectExplorationRecordsHorizontal projectId={7} completions={[finalWork]} />)

    const workLink = screen.getByRole("link", { name: /查看作品并留言/ })
    expect(workLink).toHaveAttribute("href", "/works/42")
  })

  it("keeps progress records on the exploration record page without a work CTA", () => {
    render(
      <ProjectExplorationRecordsHorizontal
        projectId={7}
        completions={[{ ...finalWork, id: 43, recordKind: "progress" }]}
      />,
    )

    expect(screen.getByRole("link")).toHaveAttribute("href", "/project/7/records?highlight=43")
    expect(screen.queryByText("查看作品并留言")).not.toBeInTheDocument()
  })

  it("explains where to leave a message when the project has a work", () => {
    render(<ProjectExplorationRecordsBlock projectId={7} completions={[finalWork]} />)

    expect(screen.getByText("想留言或提问？")).toBeInTheDocument()
    expect(screen.getByText("打开下面的作品，在作品详情里交流。")).toBeInTheDocument()
  })

  it("explains that uploading a work unlocks messages when there are no records", () => {
    render(<ProjectExplorationRecordsBlock projectId={7} completions={[]} />)

    expect(
      screen.getByText("暂时还没有作品；上传作品后，就可以在作品详情里留言和提问。"),
    ).toBeInTheDocument()
    expect(screen.queryByText("查看作品并留言")).not.toBeInTheDocument()
  })
})
