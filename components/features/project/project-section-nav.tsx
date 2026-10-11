"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type ProjectSection = {
  id: "project-materials" | "project-steps" | "project-exploration-records"
  label: string
}

const sections: ProjectSection[] = [
  { id: "project-materials", label: "材料" },
  { id: "project-steps", label: "步骤" },
  { id: "project-exploration-records", label: "探索记录" },
]

export interface ProjectSectionNavProps {
  variant?: "horizontal" | "vertical"
  mobile?: boolean
  viewingGuide?: boolean; practicePending?: boolean
  className?: string
}

export function ProjectSectionNav({ variant = "horizontal", mobile = false, viewingGuide = false, className }: ProjectSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const targets = sections
      .map(({ id }) => document.getElementById(mobile ? `${id}-mobile` : id))
      .filter((element): element is HTMLElement => Boolean(element))
    if (targets.length === 0) return

    const updateActive = () => {
      const visibleTargets = targets.filter((element) => element.getClientRects().length > 0)
      const passed = visibleTargets.filter((element) => {
        const anchorOffset = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop) || 120
        return element.getBoundingClientRect().top <= anchorOffset + 2
      })
      setActiveId((passed.at(-1) ?? visibleTargets[0])?.id ?? null)
    }

    updateActive()
    window.addEventListener("scroll", updateActive, { passive: true })
    window.addEventListener("resize", updateActive)
    return () => {
      window.removeEventListener("scroll", updateActive)
      window.removeEventListener("resize", updateActive)
    }
  }, [mobile])

  return (
    <nav
      aria-label="项目详情快捷导航"
      className={cn(
        "flex gap-1",
        variant === "vertical" ? "flex-col items-stretch" : "flex-row flex-wrap items-center",
        className,
      )}
    >
      {sections.map(({ id, label }) => {
        const targetId = mobile ? `${id}-mobile` : id
        return (
          <a
            key={targetId}
            href={`#${targetId}`}
            aria-current={activeId === targetId ? "location" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              variant === "vertical" && "w-full justify-start",
              activeId === targetId && "bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]",
            )}
          >
            {viewingGuide && id === "project-materials" ? "观看准备" : viewingGuide && id === "project-steps" ? "观看要点" : label}
          </a>
        )
      })}
    </nav>
  )
}
