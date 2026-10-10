"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useExploreBackHref } from "@/components/features/project/explore-project-context"
import { ProjectSectionNav } from "@/components/features/project/project-section-nav"

interface ProjectDetailMobileHeaderProps {
  title: string
  /** Used to pick up the explore list (with filters) this page was opened from. */
  projectId?: string | number
  /** Fallback when there is no explore navigation context. */
  backHref: string
  viewingGuide?: boolean; practicePending?: boolean
  actions: ReactNode
}

export function ProjectDetailMobileHeader({ title, projectId, backHref: fallbackBackHref, actions, practicePending = false, viewingGuide = false }: ProjectDetailMobileHeaderProps) {
  const backHref = useExploreBackHref(projectId ?? "", fallbackBackHref)
  const rowRef = useRef<HTMLDivElement>(null)
  const [chaptersVisible, setChaptersVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      const hero = document.getElementById("project-hero-mobile")
      const row = rowRef.current
      setChaptersVisible(Boolean(hero && row && hero.getBoundingClientRect().bottom <= row.getBoundingClientRect().bottom))
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
    <>
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(56px + env(safe-area-inset-top))" }}
      />
      <header className="fixed inset-x-0 top-0 z-50 bg-background/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md md:hidden">
        <div ref={rowRef} className="flex h-14 items-center gap-2 px-3">
          <Link
            href={backHref}
            aria-label="返回探索"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</p>
          <div className="flex min-w-0 shrink-0 items-center gap-1">{actions}</div>
        </div>
        {chaptersVisible ? (
          <ProjectSectionNav practicePending={practicePending} viewingGuide={viewingGuide} mobile className="border-t border-border/60 px-3 py-1" />
        ) : null}
      </header>
    </>
  )
}
