"use client"

import { useEffect, useState } from "react"

import { ProjectDetailActions } from "@/components/features/project/project-detail-actions"
import { cn } from "@/lib/utils"

interface ProjectDetailStickyBarProps {
  title: string
  projectId: number | string
  mode?: "project" | "observation"
}

export function ProjectDetailStickyBar({
  title,
  projectId,
  mode = "project",
}: ProjectDetailStickyBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > Math.min(window.innerHeight * 0.72, 760))
    }

    updateVisibility()
    window.addEventListener("scroll", updateVisibility, { passive: true })
    window.addEventListener("resize", updateVisibility)

    return () => {
      window.removeEventListener("scroll", updateVisibility)
      window.removeEventListener("resize", updateVisibility)
    }
  }, [])

  const scrollTo = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-16 z-40 hidden border-b border-border/70 bg-background/92 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)] backdrop-blur-xl transition duration-200 md:block",
        visible ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="app-shell-wide flex h-14 items-center justify-between gap-5 px-8">
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-bold text-foreground">{title}</p>
        </div>
        <nav className="pointer-events-auto hidden shrink-0 items-center gap-1 xl:flex" aria-label="项目详情快捷导航">
          {[
            ["project-materials", "材料"],
            ["project-steps", "步骤"],
            ["project-exploration-records", "探索记录"],
          ].map(([targetId, label]) => (
            <button
              key={targetId}
              type="button"
              onClick={() => scrollTo(targetId)}
              className="h-8 rounded-xs px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </button>
          ))}
        </nav>
        <ProjectDetailActions
          projectId={projectId}
          projectTitle={title}
          mode={mode}
          variant="sticky"
        />
      </div>
    </div>
  )
}
