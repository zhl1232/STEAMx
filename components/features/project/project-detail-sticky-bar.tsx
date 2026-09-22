"use client"

import { useEffect, useState } from "react"

import { ProjectDetailActions } from "@/components/features/project/project-detail-actions"
import { ProjectSectionNav } from "@/components/features/project/project-section-nav"
import { cn } from "@/lib/utils"

interface ProjectDetailStickyBarProps {
  title: string
  projectId: number | string
  mode?: "project" | "observation"
  projectAuthor?: string
  projectImage?: string | null
  projectCategory?: string | null
}

export function ProjectDetailStickyBar({
  title,
  projectId,
  mode = "project",
  projectAuthor,
  projectImage,
  projectCategory,
}: ProjectDetailStickyBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      const hero = document.getElementById("project-hero-desktop")
      setVisible(Boolean(hero && hero.getBoundingClientRect().bottom <= 64))
    }

    updateVisibility()
    window.addEventListener("scroll", updateVisibility, { passive: true })
    window.addEventListener("resize", updateVisibility)

    return () => {
      window.removeEventListener("scroll", updateVisibility)
      window.removeEventListener("resize", updateVisibility)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-16 z-40 hidden border-b border-border/70 bg-background/92 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)] backdrop-blur-xl transition duration-200 md:block",
        visible ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="app-shell-wide flex h-14 items-center justify-between gap-5 px-8">
        <div className="hidden min-w-0 lg:block">
          <p className="truncate font-sans text-sm font-bold text-foreground">{title}</p>
        </div>
        <ProjectSectionNav className="pointer-events-auto hidden shrink-0 md:flex" />
        <ProjectDetailActions
          projectId={projectId}
          projectTitle={title}
          mode={mode}
          variant="sticky"
          projectAuthor={projectAuthor}
          projectImage={projectImage}
          projectCategory={projectCategory}
        />
      </div>
    </div>
  )
}
